/**
 * Motor Matemático de Simulação Ecossistêmica e Score de Sustentabilidade Rural
 * Fundamentação Científica:
 * 1. Sistema APOIA-NovoRural (Embrapa Meio Ambiente — Rodrigues & Campanhola, 2003)
 * 2. Ecologia da Paisagem & Relação Espécie-Área (MacArthur & Wilson, 1967; Metzger, 2001)
 * 3. Código Florestal Brasileiro (Lei 12.651/2012 — APPs, Nascentes e Reserva Legal)
 * 4. Regulamento Técnico da Produção Orgânica (IN MAPA 46/2011 & Portaria 52/2021 — Barreiras Vegetais contra Deriva)
 * 5. Zoneamento Energético Permacultural Zonas 0 a 5 (Mollison & Holmgren, 1978) e Sistemas ILPF (Embrapa, 2011)
 */

import { CARD_BY_ID } from '../data/cardsCatalog.js';

export const DIST_THRESHOLDS = {
  FOREST_CLUSTER: 2.85,   // Limiar de conectividade estrutural para fusão de Mancha Florestal
  ADJACENT: 2.75,         // Raio de interação direta forte (sinergias e conflitos imediatos)
  NEIGHBORHOOD: 3.70,     // Raio de zona funcional (logística, deriva aérea de agrotóxicos, polinização)
  SAFE_BUFFER: 2.65       // Distância mínima de segurança sanitária e hídrica (APP / Zona 0)
};

export class SustainabilityEngine {
  /**
   * Avalia a configuração espacial das cartas na mesa e retorna o diagnóstico completo
   */
  evaluate(activeCards) {
    if (!activeCards || activeCards.length === 0) {
      return {
        totalScore: 0,
        rating: 'Aponte p/ cartas',
        ratingColor: '#94a3b8',
        pillars: {
          biodiversidade: 0,
          aguaSolo: 0,
          producao: 0,
          bemEstar: 0
        },
        forestClusters: [],
        fusions: [],
        combos: [],
        links: [],
        events: [],
        recommendations: [
          'Posicione cartas na frente da câmera para calcular o Índice de Sustentabilidade APOIA-Rural.'
        ],
        cardStates: {}
      };
    }

    const cards = activeCards.map(c => ({
      ...CARD_BY_ID[c.id],
      ...c
    }));

    const cardStates = {};
    for (const c of cards) {
      cardStates[c.id] = {
        synergies: 0,
        conflicts: 0,
        waterQuality: 'normal', // 'crystal' | 'normal' | 'polluted'
        hasRiparianForest: false,
        hasShade: false,
        hasCoop: false,
        hasBiodigester: false,
        isAgroforestry: false,
        isPollinating: false,
        beeCount: 0,
        forestClusterLevel: c.type === 'tree' ? 1 : 0
      };
    }

    const links = [];
    const events = [];
    const recommendations = [];

    // Pontuações base das 4 Dimensões (escala 0 a 100)
    let bioPoints = 18;
    let waterPoints = 42;
    let prodPoints = 20;
    let wellPoints = 38;

    const treeCards = cards.filter(c => c.type === 'tree');
    const waterCards = cards.filter(c => c.type === 'water');
    const cropCards = cards.filter(c => c.type === 'crop' && (c.subtype === 'grains' || c.subtype === 'orchard'));
    const beehives = cards.filter(c => c.subtype === 'beehive');
    const bioinputs = cards.filter(c => c.subtype === 'bioinput');
    const pesticides = cards.filter(c => c.subtype === 'pesticide');
    const biodigesters = cards.filter(c => c.subtype === 'biodigester');
    const solarPanels = cards.filter(c => c.subtype === 'solar');
    const pigs = cards.filter(c => c.subtype === 'pig');
    const cows = cards.filter(c => c.subtype === 'cow');
    const chickens = cards.filter(c => c.subtype === 'chicken');
    const coops = cards.filter(c => c.subtype === 'coop');
    const barns = cards.filter(c => c.subtype === 'barn');
    const tractors = cards.filter(c => c.subtype === 'tractor');
    const houses = cards.filter(c => c.type === 'house');

    // -------------------------------------------------------------------------
    // 1. ECOLOGIA DA PAISAGEM: MANCHAS FLORESTAIS (Lei de Potência S = c * A^z)
    // -------------------------------------------------------------------------
    const forestClusters = this.computeForestClusters(treeCards);

    for (const cluster of forestClusters) {
      for (const member of cluster.members) {
        cardStates[member.id].forestClusterLevel = cluster.level;
      }

      const k = cluster.members.length;
      if (k === 1) {
        bioPoints += 9;
        events.push({
          type: 'neutral',
          icon: '🌱',
          title: `${cluster.members[0].shortName} Isolada (Alto Efeito de Borda)`,
          desc: 'Fragmento unitário (+9 Bio). Aproxime 2 ou 3 árvores para reduzir o efeito de borda e formar Mancha Florestal.'
        });
      } else if (k === 2) {
        // Ganho não-linear k^1.45
        bioPoints += 26;
        waterPoints += 8;
        const [t1, t2] = cluster.members;
        links.push({
          fromId: t1.id,
          toId: t2.id,
          type: 'forest',
          label: '🌿 Mancha Florestal Nv.2 (+Arbustos)',
          deltaScore: '+26',
          color: '#22c55e'
        });
        events.push({
          type: 'positive',
          icon: '🌿',
          title: 'Mancha Florestal Nv. 2 (Corredor Ecológico)',
          desc: 'Conectividade estrutural entre 2 árvores ativou regeneração do estrato arbustivo (+26 Bio, +8 Água).'
        });
      } else if (k >= 3) {
        const bonus = Math.round(14 * Math.pow(k, 1.15)); // k=3 -> 50, k=4 -> 69
        bioPoints += bonus;
        waterPoints += 16;
        wellPoints += 10;

        for (let i = 0; i < cluster.members.length; i++) {
          const a = cluster.members[i];
          const b = cluster.members[(i + 1) % cluster.members.length];
          links.push({
            fromId: a.id,
            toId: b.id,
            type: 'forest',
            label: i === 0 ? `🦜 Mancha Florestal Nv.3 (+Fauna)` : '🌳 Dossel Fechado',
            deltaScore: i === 0 ? `+${bonus}` : '',
            color: '#10b981'
          });
        }
        events.push({
          type: 'positive',
          icon: '🦜',
          title: `Ecossistema Florestal Nv. 3 (${k} Árvores + Fauna)`,
          desc: `Área nuclear interior formada! Abriga avifauna e pequenos mamíferos/roedores (+${bonus} Bio).`
        });
      }
    }

    if (treeCards.length === 0 && cards.length >= 2) {
      bioPoints -= 18;
      waterPoints -= 15;
      events.push({
        type: 'negative',
        icon: '⚠️',
        title: 'Déficit de Reserva Legal (Código Florestal)',
        desc: 'Ausência de cobertura arbórea nativa reduz infiltração de água e biodiversidade (-18 Bio, -15 Água).'
      });
    }

    // -------------------------------------------------------------------------
    // 1.5. MESCLAS DE POPULAÇÃO ANIMAL (2x1) E AGROSSISTEMAS INTEGRADOS (3x1)
    // -------------------------------------------------------------------------
    const { fusions, fusedCardIds } = this.computeCardFusions(cards);

    for (const fusion of fusions) {
      if (fusion.type === 'herd_cow' || fusion.type === 'flock_chicken' || fusion.type === 'herd_pig') {
        prodPoints += 16;
        wellPoints += 12;
        bioPoints += 6;
        events.push({
          type: 'positive',
          icon: fusion.type === 'herd_cow' ? '🐄' : fusion.type === 'flock_chicken' ? '🐔' : '🐖',
          title: `${fusion.label}`,
          desc: 'Escala produtiva e bem-estar gregário: os dois lotes se uniram formando uma população maior (+16 Prod, +12 Bem-Estar)!'
        });
      } else if (fusion.type === 'mansion_farmhouse' || fusion.type === 'solar_park' || fusion.type === 'barn_complex' || fusion.type === 'mega_solar_barn') {
        prodPoints += 18;
        wellPoints += 18;
        waterPoints += 8;
        events.push({
          type: 'positive',
          icon: fusion.type === 'mansion_farmhouse' ? '🏛️' : fusion.type === 'solar_park' ? '☀️' : '🏚️',
          title: `${fusion.label}`,
          desc: 'Infraestrutura expandida e energia limpa: fusão de 2 cartas formou um novo complexo arquitetônico (+18 Prod, +18 Bem-Estar)!'
        });
      } else if (fusion.type.startsWith('agrosystem_')) {
        prodPoints += 26;
        waterPoints += 18;
        bioPoints += 16;
        wellPoints += 18;
        for (const m of fusion.members) {
          if (fusion.type === 'agrosystem_swine_biogas' || fusion.type === 'agrosystem_cattle_biogas') {
            cardStates[m.id].hasBiodigester = true;
          }
          if (fusion.type === 'agrosystem_silvopasture') {
            cardStates[m.id].hasShade = true;
          }
          if (fusion.type === 'agrosystem_poultry_farm') {
            cardStates[m.id].hasCoop = true;
          }
          if (fusion.type === 'agrosystem_agro_poultry') {
            cardStates[m.id].isAgroforestry = true;
          }
        }
        events.push({
          type: 'positive',
          icon: '🏆',
          title: `${fusion.label}`,
          desc: 'Agrossistema completo de 3 cartas formado! Máxima sinergia produtiva, ciclagem de nutrientes e bem-estar animal (+26 Prod, +18 Água, +18 Bem-Estar)!'
        });
      }
    }

    // -------------------------------------------------------------------------
    // 2. SANEAMENTO PRODUTIVO (BIODIGESTOR + SUINOCULTURA / BOVINOCULTURA)
    // -------------------------------------------------------------------------
    for (const pig of pigs) {
      const nearBio = biodigesters.find(b => this.dist(pig, b) <= DIST_THRESHOLDS.ADJACENT);
      if (nearBio) {
        cardStates[pig.id].hasBiodigester = true;
        cardStates[nearBio.id].hasBiodigester = true;
        waterPoints += 20;
        prodPoints += 16;
        wellPoints += 12;
        links.push({
          fromId: pig.id,
          toId: nearBio.id,
          type: 'positive',
          label: '♻️ Biodigestão de Dejetos (Biogás + Biofertilizante)',
          deltaScore: '+20',
          color: '#14b8a6'
        });
        events.push({
          type: 'positive',
          icon: '♻️',
          title: 'Manejo Sustentável de Dejetos (Porco + Biodigestor)',
          desc: 'Biodigestão anaeróbia abate 80% da carga poluidora (DBO) e odor, gerando biogás e biofertilizante (+20 Água, +16 Prod)!'
        });
      }
    }

    for (const cow of cows) {
      const nearBio = biodigesters.find(b => this.dist(cow, b) <= DIST_THRESHOLDS.ADJACENT);
      if (nearBio) {
        cardStates[cow.id].hasBiodigester = true;
        waterPoints += 10;
        prodPoints += 12;
        links.push({
          fromId: cow.id,
          toId: nearBio.id,
          type: 'positive',
          label: '♻️ Compostagem Bovina',
          deltaScore: '+12',
          color: '#14b8a6'
        });
      }
    }

    // -------------------------------------------------------------------------
    // 3. RECURSOS HÍDRICOS (AÇUDE & NASCENTE — Lei 12.651/2012 APP)
    // -------------------------------------------------------------------------
    for (const water of waterCards) {
      waterPoints += 10;
      let riparianTrees = 0;
      let polluted = false;

      for (const tree of treeCards) {
        const d = this.dist(water, tree);
        if (d <= DIST_THRESHOLDS.ADJACENT) {
          riparianTrees++;
          const weight = this.decayWeight(d, DIST_THRESHOLDS.ADJACENT);
          const pts = Math.round(14 + 8 * weight);
          waterPoints += pts;
          bioPoints += 6;
          links.push({
            fromId: tree.id,
            toId: water.id,
            type: 'positive',
            label: `💧 Mata Ciliar em APP (+${pts})`,
            deltaScore: `+${pts}`,
            color: '#0ea5e9'
          });
        }
      }

      // Contaminação por Porco perto da Água
      for (const pig of pigs) {
        const d = this.dist(water, pig);
        if (d <= DIST_THRESHOLDS.SAFE_BUFFER) {
          const hasTreeBarrier = this.hasBarrierBetween(pig, water, treeCards);
          const treated = cardStates[pig.id].hasBiodigester;
          // Atenuação científica: Biodigestor reduz 75% da DBO; Mata Ciliar retém 60% do escoamento
          let penalty = 36;
          if (treated) penalty = Math.round(penalty * 0.25);
          if (hasTreeBarrier) penalty = Math.round(penalty * 0.45);

          waterPoints -= penalty;
          bioPoints -= Math.round(penalty * 0.4);
          if (penalty >= 14) {
            polluted = true;
            cardStates[pig.id].conflicts++;
          }
          links.push({
            fromId: pig.id,
            toId: water.id,
            type: 'negative',
            label: treated ? '⚠️ Proximidade Hídrica (Mitigada p/ Biodigestor)' : '☣️ Efluente Suíno na Água (Eutrofização!)',
            deltaScore: `-${penalty}`,
            color: '#ef4444'
          });
          events.push({
            type: 'negative',
            icon: '☣️',
            title: `Risco Hídrico: Suinocultura próxima a ${water.shortName}`,
            desc: treated
              ? `Mesmo com Biodigestor, recomenda-se afastar a baia da APP (-${penalty} Água).`
              : `Alta carga de coliformes e fósforo escoando para ${water.shortName} (-${penalty} Água). Adicione um Biodigestor ou afaste!`
          });
        }
      }

      // Contaminação por Agrotóxico perto da Água
      for (const pest of pesticides) {
        const d = this.dist(water, pest);
        if (d <= DIST_THRESHOLDS.NEIGHBORHOOD) {
          const hasTreeBarrier = this.hasBarrierBetween(pest, water, treeCards);
          const penalty = hasTreeBarrier ? 14 : 38;
          waterPoints -= penalty;
          bioPoints -= Math.round(penalty * 0.5);
          polluted = true;
          cardStates[pest.id].conflicts++;
          links.push({
            fromId: pest.id,
            toId: water.id,
            type: 'negative',
            label: hasTreeBarrier ? '⚠️ Deriva Química (Atendida p/ Barreira Vegetal)' : '☠️ Contaminação por Agrotóxico na Água!',
            deltaScore: `-${penalty}`,
            color: '#ef4444'
          });
          events.push({
            type: 'negative',
            icon: '☠️',
            title: `Contaminação de ${water.shortName} por Agrotóxico`,
            desc: hasTreeBarrier
              ? `A barreira de árvores reteve parte da deriva, mas ainda há risco hídrico (-${penalty} Água).`
              : `Lixiviação e deriva direta de agrotóxicos atingindo ${water.shortName} (-${penalty} Água)!`
          });
        }
      }

      // Trator em APP hídrica
      for (const tr of tractors) {
        if (this.dist(water, tr) <= DIST_THRESHOLDS.SAFE_BUFFER * 0.85) {
          waterPoints -= 20;
          cardStates[tr.id].conflicts++;
          links.push({
            fromId: tr.id,
            toId: water.id,
            type: 'negative',
            label: '⚠️ Compactação de Margem (APP)',
            deltaScore: '-20',
            color: '#f97316'
          });
        }
      }

      if (polluted) {
        cardStates[water.id].waterQuality = 'polluted';
      } else if (riparianTrees > 0) {
        cardStates[water.id].waterQuality = 'crystal';
        cardStates[water.id].hasRiparianForest = true;
      }
    }

    // -------------------------------------------------------------------------
    // 4. POLINIZAÇÃO (APIÁRIO), PASTO APÍCOLA E INSUMOS (Embrapa / IN MAPA 46/2011)
    // -------------------------------------------------------------------------
    for (const bee of beehives) {
      bioPoints += 14;
      let pollinationPartners = 0;
      let poisonedByPesticide = false;

      // 4.1. Conflito mortal: Agrotóxico perto do Apiário!
      for (const pest of pesticides) {
        const d = this.dist(bee, pest);
        if (d <= DIST_THRESHOLDS.NEIGHBORHOOD) {
          const hasBarrier = this.hasBarrierBetween(pest, bee, treeCards);
          if (!hasBarrier) poisonedByPesticide = true;
          const penalty = hasBarrier ? 16 : 40;
          bioPoints -= penalty;
          prodPoints -= 15;
          cardStates[bee.id].conflicts++;
          cardStates[pest.id].conflicts++;
          links.push({
            fromId: pest.id,
            toId: bee.id,
            type: 'negative',
            label: '☠️ Mortalidade de Abelhas por Deriva Química!',
            deltaScore: `-${penalty}`,
            color: '#ef4444'
          });
          events.push({
            type: 'negative',
            icon: '🐝',
            title: 'Colapso de Colmeias por Deriva de Agrotóxico!',
            desc: hasBarrier
              ? `Mesmo com barreira vegetal parcial, o agrotóxico afeta as abelhas (-${penalty} Bio). Substitua por Bioinsumos!`
              : `Pulverização química próxima ao Apiário causa mortalidade massiva de polinizadores (-${penalty} Bio, -15 Prod)!`
          });
        }
      }

      // 4.2. Pasto Apícola Arbóreo (Árvores Nativas: Ipê, Jatobá, Araucária, Palmeira)
      const nearTrees = treeCards.filter(t => this.dist(bee, t) <= DIST_THRESHOLDS.NEIGHBORHOOD);
      for (const tree of nearTrees) {
        pollinationPartners++;
        bioPoints += 12;
        if (!poisonedByPesticide) {
          cardStates[tree.id].beeCount = Math.max(cardStates[tree.id].beeCount, 4);
          cardStates[tree.id].isPollinating = true;
        }
        links.push({
          fromId: bee.id,
          toId: tree.id,
          type: 'positive',
          label: '🐝 Pasto Apícola Arbóreo (Néctar & Própolis)',
          deltaScore: '+12',
          color: '#facc15'
        });
      }

      // 4.3. Polinização Agrícola Entomófila (Horta & Lavoura)
      for (const crop of cropCards) {
        if (this.dist(bee, crop) <= DIST_THRESHOLDS.NEIGHBORHOOD) {
          pollinationPartners++;
          prodPoints += 18;
          bioPoints += 8;
          cardStates[crop.id].isAgroforestry = true;
          if (!poisonedByPesticide) {
            cardStates[crop.id].beeCount = Math.max(cardStates[crop.id].beeCount, 5);
            cardStates[crop.id].isPollinating = true;
          }
          links.push({
            fromId: bee.id,
            toId: crop.id,
            type: 'positive',
            label: '🐝 Polinização Intensiva (+Produtividade)',
            deltaScore: '+18',
            color: '#facc15'
          });
          events.push({
            type: 'positive',
            icon: '🐝',
            title: `Polinização Entomófila (Apiário + ${crop.shortName})`,
            desc: 'Abelhas forrageiras aumentam o vingamento de frutos e grãos em até 25% (+18 Produção, +8 Bio)!'
          });
        }
      }

      // 4.4. Fonte de Água Limpa para Termorregulação da Colmeia (Açude / Nascente não poluídos)
      for (const water of waterCards) {
        if (this.dist(bee, water) <= DIST_THRESHOLDS.NEIGHBORHOOD && cardStates[water.id].waterQuality !== 'polluted') {
          pollinationPartners++;
          waterPoints += 8;
          bioPoints += 8;
          wellPoints += 6;
          links.push({
            fromId: bee.id,
            toId: water.id,
            type: 'positive',
            label: '🐝💧 Hidratação & Termorregulação da Colmeia',
            deltaScore: '+16',
            color: '#38bdf8'
          });
        }
      }

      // 4.5. Sinergia com Bioinsumos (Manejo Integrado Amigo das Abelhas)
      for (const bio of bioinputs) {
        if (this.dist(bee, bio) <= DIST_THRESHOLDS.NEIGHBORHOOD) {
          pollinationPartners++;
          bioPoints += 10;
          prodPoints += 8;
        }
      }

      // Ativa o enxame de abelhinhas 3D ao redor do Apiário proporcional à riqueza do Pasto Apícola!
      if (pollinationPartners > 0 && !poisonedByPesticide) {
        cardStates[bee.id].isPollinating = true;
        cardStates[bee.id].beeCount = Math.min(8, 3 + pollinationPartners * 2);
      } else {
        cardStates[bee.id].beeCount = 0;
      }
    }

    // Propaga o enxame de abelhas também para as Mesclas 2x1 / Agrossistemas 3x1 próximos ao Apiário!
    for (const fusion of fusions) {
      if (fusion.members.some(m => cardStates[m.id]?.beeCount > 0)) {
        fusion.hasBees = true;
      }
    }

    // Bioinsumos (Controle Biológico)
    for (const bio of bioinputs) {
      waterPoints += 8;
      bioPoints += 8;
      for (const crop of cropCards) {
        if (this.dist(bio, crop) <= DIST_THRESHOLDS.ADJACENT) {
          prodPoints += 20;
          waterPoints += 10;
          links.push({
            fromId: bio.id,
            toId: crop.id,
            type: 'positive',
            label: '🧪 Controle Biológico & Solo Vivo',
            deltaScore: '+20',
            color: '#10b981'
          });
          events.push({
            type: 'positive',
            icon: '🧪',
            title: `Manejo Biológico (${crop.shortName} + Bioinsumos)`,
            desc: 'Uso de biofertilizantes e inimigos naturais controla pragas sem contaminar lençol freático ou abelhas (+20 Prod, +10 Água).'
          });
        }
      }
      // Conflito Agronômico: Agrotóxico próximo ao Bioinsumo inativa os microrganismos benéficos!
      for (const pest of pesticides) {
        if (this.dist(bio, pest) <= DIST_THRESHOLDS.ADJACENT) {
          prodPoints -= 14;
          bioPoints -= 12;
          cardStates[bio.id].conflicts++;
          cardStates[pest.id].conflicts++;
          links.push({
            fromId: pest.id,
            toId: bio.id,
            type: 'negative',
            label: '☠️ Inativação Biológica (Agrotóxico mata Bioinsumo!)',
            deltaScore: '-14',
            color: '#ef4444'
          });
          events.push({
            type: 'negative',
            icon: '⚠️',
            title: 'Incompatibilidade: Agrotóxico + Bioinsumos',
            desc: 'Fungicidas e inseticidas químicos sintéticos eliminam os fungos e bactérias benéficas (Trichoderma/Bt) do Bioinsumo (-14 Prod, -12 Bio).'
          });
        }
      }
    }
    for (const pest of pesticides) {
      waterPoints -= 10;
      bioPoints -= 10;
      for (const crop of cropCards) {
        const d = this.dist(pest, crop);
        if (d <= DIST_THRESHOLDS.ADJACENT) {
          if (crop.subtype === 'orchard') {
            // Horta Agroecológica perde certificação orgânica se exposta a agrotóxico sem barreira!
            const hasBarrier = this.hasBarrierBetween(pest, crop, treeCards);
            const pen = hasBarrier ? 10 : 28;
            prodPoints -= pen;
            wellPoints -= 15;
            cardStates[crop.id].conflicts++;
            links.push({
              fromId: pest.id,
              toId: crop.id,
              type: 'negative',
              label: hasBarrier ? '🛡️ Deriva Retida p/ Quebra-Vento (IN 46)' : '☠️ Perda de Selo Orgânico por Deriva!',
              deltaScore: `-${pen}`,
              color: hasBarrier ? '#f59e0b' : '#ef4444'
            });
            events.push({
              type: 'negative',
              icon: '🥬',
              title: 'Deriva de Agrotóxico na Horta (IN MAPA 46/2011)',
              desc: hasBarrier
                ? 'A barreira de árvores reduziu a deriva em 65%, protegendo parcialmente a Horta.'
                : 'Deriva química direta inviabiliza a produção orgânica na Horta (-28 Prod). Interponha uma Barreira de Árvores ou use Bioinsumos!'
            });
          } else {
            // Na lavoura de grãos convencional dá pequeno ganho bruto, mas cobra preço ambiental
            prodPoints += 10;
            waterPoints -= 12;
            links.push({
              fromId: pest.id,
              toId: crop.id,
              type: 'negative',
              label: '⚠️ Manejo Químico Convencional (+Prod / -Água)',
              deltaScore: '-12',
              color: '#f97316'
            });
          }
        }
      }

      // Agrotóxico perto da Casa Sede
      for (const house of houses) {
        if (this.dist(pest, house) <= DIST_THRESHOLDS.NEIGHBORHOOD) {
          wellPoints -= 32;
          cardStates[house.id].conflicts++;
          links.push({
            fromId: pest.id,
            toId: house.id,
            type: 'negative',
            label: '☠️ Risco de Intoxicação na Moradia!',
            deltaScore: '-32',
            color: '#ef4444'
          });
          events.push({
            type: 'negative',
            icon: '☠️',
            title: 'Perigo Sanitário: Agrotóxico próximo à Casa Sede!',
            desc: 'Deriva de defensivos químicos sobre a residência familiar compromete gravemente a saúde (-32 Bem-Estar).'
          });
        }
      }
    }

    // -------------------------------------------------------------------------
    // 5. INTEGRAÇÃO LAVOURA-PECUÁRIA-FLORESTA (ILPF), ENERGIA SOLAR & ZONA 0
    // -------------------------------------------------------------------------
    const mergedZones = [];

    // Mescla 2: Grande Lavoura Consorciada / Policultivo (2+ Plantações próximas)
    for (let i = 0; i < cropCards.length; i++) {
      for (let j = i + 1; j < cropCards.length; j++) {
        const c1 = cropCards[i];
        const c2 = cropCards[j];
        if (this.dist(c1, c2) <= DIST_THRESHOLDS.ADJACENT * 1.1) {
          prodPoints += 18;
          bioPoints += 12;
          waterPoints += 8;
          links.push({
            fromId: c1.id,
            toId: c2.id,
            type: 'positive',
            label: '🌾 Grande Lavoura Consorciada (Policultivo)',
            deltaScore: '+18',
            color: '#eab308'
          });
          mergedZones.push({
            id: `merge_crop_${c1.id}_${c2.id}`,
            type: 'crop_merge',
            label: '🌾 Grande Lavoura Consorciada',
            members: [c1, c2]
          });
        }
      }
    }

    // Mescla 4: Microbacia Hidrográfica (Nascente + Açude conectados por Riacho e Ponte)
    for (let i = 0; i < waterCards.length; i++) {
      for (let j = i + 1; j < waterCards.length; j++) {
        const w1 = waterCards[i];
        const w2 = waterCards[j];
        if (this.dist(w1, w2) <= DIST_THRESHOLDS.NEIGHBORHOOD * 1.05) {
          mergedZones.push({
            id: `merge_water_${w1.id}_${w2.id}`,
            type: 'watershed_merge',
            label: '🌉 Microbacia & Córrego Conectado',
            members: [w1, w2]
          });
        }
      }
    }

    for (const crop of cropCards) {
      prodPoints += 12;
      const nearTrees = treeCards.filter(t => this.dist(crop, t) <= DIST_THRESHOLDS.ADJACENT);
      if (nearTrees.length > 0) {
        cardStates[crop.id].isAgroforestry = true;
        prodPoints += 15;
        bioPoints += 10;
        waterPoints += 8;
        links.push({
          fromId: crop.id,
          toId: nearTrees[0].id,
          type: 'positive',
          label: '🌳 Sistema Agroflorestal / SAF',
          deltaScore: '+15',
          color: '#84cc16'
        });
        mergedZones.push({
          id: `merge_saf_${crop.id}_${nearTrees[0].id}`,
          type: 'agroforestry_merge',
          label: '🌳 Sistema Agroflorestal (SAF)',
          members: [crop, nearTrees[0]]
        });
      }

      // Mescla 5: Perímetro Irrigado (Água + Plantação)
      const nearWater = waterCards.find(w => this.dist(crop, w) <= DIST_THRESHOLDS.ADJACENT * 1.12);
      if (nearWater && cardStates[nearWater.id]?.waterQuality !== 'polluted') {
        prodPoints += 14;
        waterPoints += 8;
        links.push({
          fromId: nearWater.id,
          toId: crop.id,
          type: 'positive',
          label: '💧 Canal de Irrigação Sustentável',
          deltaScore: '+14',
          color: '#38bdf8'
        });
        mergedZones.push({
          id: `merge_irrig_${nearWater.id}_${crop.id}`,
          type: 'irrigation_merge',
          label: '💧 Perímetro Irrigado',
          members: [nearWater, crop]
        });
      }

      const nearBarn = barns.find(b => this.dist(crop, b) <= DIST_THRESHOLDS.NEIGHBORHOOD);
      if (nearBarn) {
        prodPoints += 12;
        links.push({
          fromId: crop.id,
          toId: nearBarn.id,
          type: 'positive',
          label: '🏚️ Logística de Colheita',
          deltaScore: '+12',
          color: '#eab308'
        });
      }

      const nearBio = biodigesters.find(b => this.dist(crop, b) <= DIST_THRESHOLDS.NEIGHBORHOOD);
      if (nearBio) {
        prodPoints += 14;
        links.push({
          fromId: nearBio.id,
          toId: crop.id,
          type: 'positive',
          label: '♻️ Adubação com Biofertilizante',
          deltaScore: '+14',
          color: '#10b981'
        });
      }
    }

    // Vaca + Árvore (Sistema Silvipastoril - Embrapa ILPF)
    for (const cow of cows) {
      prodPoints += 10;
      const shadeTree = treeCards.find(t => this.dist(cow, t) <= DIST_THRESHOLDS.ADJACENT);
      if (shadeTree) {
        cardStates[cow.id].hasShade = true;
        wellPoints += 18;
        prodPoints += 12;
        links.push({
          fromId: cow.id,
          toId: shadeTree.id,
          type: 'positive',
          label: '🐄 Sistema Silvipastoril (Sombra ILPF)',
          deltaScore: '+18',
          color: '#22c55e'
        });
        mergedZones.push({
          id: `merge_ilpf_${cow.id}_${shadeTree.id}`,
          type: 'silvopasture_merge',
          label: '🐄 Bosque Silvipastoril (ILPF)',
          members: [cow, shadeTree]
        });
      }
    }

    // Galinhas + Galinheiro + Horta
    for (const chk of chickens) {
      prodPoints += 8;
      const nearCoop = coops.find(c => this.dist(chk, c) <= DIST_THRESHOLDS.ADJACENT);
      if (nearCoop) {
        cardStates[chk.id].hasCoop = true;
        wellPoints += 15;
        prodPoints += 12;
        links.push({
          fromId: chk.id,
          toId: nearCoop.id,
          type: 'positive',
          label: '🥚 Pátio Avícola Caipira',
          deltaScore: '+15',
          color: '#fbbf24'
        });
        mergedZones.push({
          id: `merge_poultry_${chk.id}_${nearCoop.id}`,
          type: 'poultry_merge',
          label: '🥚 Pátio Avícola Caipira',
          members: [chk, nearCoop]
        });
      }
      const nearCrop = cropCards.find(c => this.dist(chk, c) <= DIST_THRESHOLDS.ADJACENT);
      if (nearCrop) {
        prodPoints += 12;
        links.push({
          fromId: chk.id,
          toId: nearCrop.id,
          type: 'positive',
          label: '🐔 Controle Biológico de Insetos',
          deltaScore: '+12',
          color: '#a3e635'
        });
      }
    }

    // Mescla 7: Circuito de Biogás (Suínos/Gado + Biodigestor)
    for (const bio of biodigesters) {
      const animalSource = [...pigs, ...cows].find(a => this.dist(bio, a) <= DIST_THRESHOLDS.ADJACENT * 1.12);
      if (animalSource) {
        mergedZones.push({
          id: `merge_biogas_${bio.id}_${animalSource.id}`,
          type: 'biogas_merge',
          label: '♻️ Circuito de Biogás & Biofertilizante',
          members: [animalSource, bio]
        });
      }
    }

    // Energia Solar Fotovoltaica
    for (const sol of solarPanels) {
      wellPoints += 10;
      prodPoints += 10;
      const targetInfra = [...houses, ...barns, ...biodigesters].find(
        inf => this.dist(sol, inf) <= DIST_THRESHOLDS.NEIGHBORHOOD
      );
      if (targetInfra) {
        prodPoints += 14;
        wellPoints += 12;
        links.push({
          fromId: sol.id,
          toId: targetInfra.id,
          type: 'positive',
          label: '☀️ Energia Limpa Fotovoltaica',
          deltaScore: '+14',
          color: '#38bdf8'
        });
        events.push({
          type: 'positive',
          icon: '☀️',
          title: `Autonomia Fotovoltaica (Energia Solar + ${targetInfra.shortName})`,
          desc: 'Geração solar distribuída reduz custos operacionais e emissões de carbono (+14 Prod, +12 Bem-Estar).'
        });
      }
    }

    // Casa Sede (Zona 0 Permacultural)
    for (const house of houses) {
      wellPoints += 12;
      const nearGardenOrTree = [...treeCards, ...cropCards.filter(c => c.subtype === 'orchard')].find(
        t => this.dist(house, t) <= DIST_THRESHOLDS.ADJACENT
      );
      if (nearGardenOrTree) {
        wellPoints += 15;
        links.push({
          fromId: house.id,
          toId: nearGardenOrTree.id,
          type: 'positive',
          label: '🏡 Zoneamento Zona 0-1 (Conforto & Horta)',
          deltaScore: '+15',
          color: '#34d399'
        });
      }

      const nearBio = biodigesters.find(b => this.dist(house, b) <= DIST_THRESHOLDS.NEIGHBORHOOD);
      if (nearBio) {
        wellPoints += 12;
        links.push({
          fromId: nearBio.id,
          toId: house.id,
          type: 'positive',
          label: '🔥 Biogás Limpo p/ Cozinha',
          deltaScore: '+12',
          color: '#2dd4bf'
        });
      }

      for (const pig of pigs) {
        if (this.dist(house, pig) <= DIST_THRESHOLDS.SAFE_BUFFER * 0.9) {
          const treated = cardStates[pig.id].hasBiodigester;
          const pen = treated ? 8 : 24;
          wellPoints -= pen;
          links.push({
            fromId: pig.id,
            toId: house.id,
            type: 'negative',
            label: treated ? '⚠️ Baia próxima à Casa' : '💨 Odor & Risco Sanitário na Casa Sede!',
            deltaScore: `-${pen}`,
            color: '#ef4444'
          });
        }
      }
    }

    const clamp = v => Math.max(0, Math.min(100, Math.round(v)));
    const pillars = {
      biodiversidade: clamp(bioPoints),
      aguaSolo: clamp(waterPoints),
      producao: clamp(prodPoints),
      bemEstar: clamp(wellPoints)
    };

    // Média Ponderada Multi-Critério (inspirada nos pesos APOIA-NovoRural)
    // Mas penalizada por Fator Limitante de Liebig se algum pilar crítico (ex: Água) colapsar!
    const weightedMean =
      pillars.biodiversidade * 0.28 +
      pillars.aguaSolo * 0.30 +
      pillars.producao * 0.22 +
      pillars.bemEstar * 0.20;

    const minPillar = Math.min(pillars.biodiversidade, pillars.aguaSolo, pillars.producao, pillars.bemEstar);
    const liebigPenalty = minPillar < 25 ? (25 - minPillar) * 0.45 : 0;
    const totalScore = clamp(weightedMean - liebigPenalty);

    let rating = 'Em Planejamento';
    let ratingColor = '#38bdf8';
    if (totalScore >= 80) {
      rating = '🏆 Sustentável';
      ratingColor = '#10b981';
    } else if (totalScore >= 62) {
      rating = '🌿 Equilibrado';
      ratingColor = '#22c55e';
    } else if (totalScore >= 42) {
      rating = '⚖️ Em Transição';
      ratingColor = '#facc15';
    } else {
      rating = '⚠️ Alerta Ambiental';
      ratingColor = '#ef4444';
    }

    const combos = this.buildActiveCombosList(forestClusters, fusions, links, beehives, cardStates);

    return {
      totalScore,
      rating,
      ratingColor,
      pillars,
      forestClusters,
      fusions,
      fusedCardIds,
      mergedZones: fusions,
      combos,
      links,
      events,
      recommendations,
      cardStates
    };
  }

  /**
   * Consolida todos os combos, fusões 2x1/3x1, manchas florestais e sinergias ativas na mesa
   * para exibição em lista abaixo da barra de personagem do HUD e na foto compartilhável.
   */
  buildActiveCombosList(forestClusters, fusions, links, beehives, cardStates) {
    const combos = [];
    const seenKeys = new Set();

    const SHORT_FUSION_NAMES = {
      agrosystem_swine_biogas: { icon: '♻️', title: 'Suinocultura & Biogás', badge: '3x1' },
      agrosystem_dairy_estate: { icon: '🐄', title: 'Estância Leiteira & Silos', badge: '3x1' },
      agrosystem_cattle_biogas: { icon: '♻️', title: 'Pecuária & Bioenergia', badge: '3x1' },
      agrosystem_silvopasture: { icon: '🌳', title: 'Sistema Silvipastoril ILPF', badge: '3x1' },
      agrosystem_poultry_farm: { icon: '🥚', title: 'Granja Avícola Caipira', badge: '3x1' },
      agrosystem_agro_poultry: { icon: '🥬', title: 'Horta & Avicultura', badge: '3x1' },
      agrosystem_solar_mansion: { icon: '🏛️', title: 'Casarão Fotovoltaico', badge: '3x1' },
      agrosystem_solar_barn: { icon: '🏚️', title: 'Complexo Solar Agrícola', badge: '3x1' },
      herd_cow: { icon: '🐄', title: 'Rebanho Bovino', badge: '2x1' },
      flock_chicken: { icon: '🐔', title: 'Bando de Galinhas', badge: '2x1' },
      herd_pig: { icon: '🐖', title: 'Vara de Suínos', badge: '2x1' },
      mansion_farmhouse: { icon: '🏛️', title: 'Casarão Colonial', badge: '2x1' },
      solar_park: { icon: '☀️', title: 'Usina Solar', badge: '2x1' },
      barn_complex: { icon: '🏚️', title: 'Complexo de Celeiros', badge: '2x1' },
      mega_solar_barn: { icon: '☀️', title: 'Celeiro Fotovoltaico', badge: '2x1' },
      mega_crop: { icon: '🌾', title: 'Grande Lavoura', badge: '2x1' },
      mega_watershed: { icon: '🏞️', title: 'Lagoa & Cachoeira', badge: '2x1' },
      mega_poultry: { icon: '🐔', title: 'Pátio Avícola', badge: '2x1' },
      mega_dairy: { icon: '🐄', title: 'Estância Leiteira', badge: '2x1' },
      mega_biogas: { icon: '♻️', title: 'Biogás Suinícola', badge: '2x1' },
      mega_solar_house: { icon: '☀️', title: 'Sede Fotovoltaica', badge: '2x1' }
    };

    // 1. Agrossistemas 3x1 e Fusões 2x1
    for (const f of fusions) {
      const info = SHORT_FUSION_NAMES[f.type] || {
        icon: '✨',
        title: f.label.replace(/^[^\wÀ-ú]+\s*/, '').replace(/\s*\([23]x1\)/, ''),
        badge: f.members?.length === 3 ? '3x1' : '2x1'
      };
      const is3x1 = f.members?.length === 3 || f.type.startsWith('agrosystem_');
      combos.push({
        id: f.id,
        icon: info.icon,
        title: info.title,
        badge: info.badge,
        tier: is3x1 ? 'agrosystem' : 'fusion'
      });
    }

    // 2. Manchas Florestais (Nv. 2 e Nv. 3)
    for (const c of forestClusters) {
      if (c.level >= 3) {
        combos.push({
          id: c.id,
          icon: '🦜',
          title: 'Floresta Nv.3 + Fauna',
          badge: `${c.members.length}x🌳`,
          tier: 'forest'
        });
      } else if (c.level === 2) {
        combos.push({
          id: c.id,
          icon: '🌿',
          title: 'Mancha Florestal Nv.2',
          badge: '2x🌳',
          tier: 'forest'
        });
      }
    }

    // 3. Polinização Apícola Ativa (Enxame de Abelhas)
    for (const bee of beehives) {
      if (cardStates[bee.id]?.isPollinating) {
        const key = 'combo_pollination_swarm';
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          combos.push({
            id: key,
            icon: '🐝',
            title: 'Polinização Apícola',
            badge: '+Abelhas',
            tier: 'synergy'
          });
        }
      }
    }

    // 4. Sinergias Ecológicas Positivas e Conflitos (sem duplicar pares já fundidos no mesmo 2x1/3x1)
    const isSameFusionPair = (idA, idB) =>
      fusions.some(f => f.members.some(m => m.id === idA) && f.members.some(m => m.id === idB));

    const CLEAN_LINK_MAP = [
      { match: 'Mata Ciliar', icon: '💧', title: 'Mata Ciliar (APP)', badge: '+Água' },
      { match: 'Sistema Agroflorestal', icon: '🌳', title: 'Agrofloresta (SAF)', badge: '+15' },
      { match: 'Canal de Irrigação', icon: '💧', title: 'Irrigação Sustentável', badge: '+14' },
      { match: 'Controle Biológico & Solo', icon: '🧪', title: 'Controle Biológico', badge: '+20' },
      { match: 'Sistema Silvipastoril', icon: '🐄', title: 'Sombra Silvipastoril', badge: '+18' },
      { match: 'Controle Biológico de Insetos', icon: '🐔', title: 'Aves no Controle de Pragas', badge: '+12' },
      { match: 'Logística de Colheita', icon: '🏚️', title: 'Logística de Safra', badge: '+12' },
      { match: 'Adubação com Biofertilizante', icon: '♻️', title: 'Biofertilizante na Lavoura', badge: '+14' },
      { match: 'Compostagem Bovina', icon: '♻️', title: 'Compostagem Bovina', badge: '+12' },
      { match: 'Biodigestão de Dejetos', icon: '♻️', title: 'Biogás & Saneamento', badge: '+20' },
      { match: 'Energia Limpa Fotovoltaica', icon: '☀️', title: 'Energia Limpa Solar', badge: '+14' },
      { match: 'Zoneamento Zona 0-1', icon: '🏡', title: 'Horta & Sombra (Zona 0)', badge: '+15' },
      { match: 'Biogás Limpo p/ Cozinha', icon: '🔥', title: 'Biogás na Moradia', badge: '+12' },
      // Conflitos
      { match: 'Inativação Biológica', icon: '☠️', title: 'Agrotóxico x Bioinsumo', badge: '-14', conflict: true },
      { match: 'Mortalidade de Abelhas', icon: '☠️', title: 'Deriva no Apiário!', badge: '-Bio', conflict: true },
      { match: 'Contaminação por Agrotóxico', icon: '☠️', title: 'Agrotóxico na Água!', badge: '-Água', conflict: true },
      { match: 'Efluente Suíno na Água', icon: '☣️', title: 'Efluente na Água!', badge: '-Água', conflict: true },
      { match: 'Perda de Selo Orgânico', icon: '⚠️', title: 'Deriva na Horta!', badge: '-Prod', conflict: true },
      { match: 'Risco de Intoxicação', icon: '☠️', title: 'Agrotóxico na Casa!', badge: '-32', conflict: true },
      { match: 'Odor & Risco Sanitário', icon: '💨', title: 'Odor na Casa Sede!', badge: '-24', conflict: true }
    ];

    for (const link of links) {
      if (link.type === 'forest') continue;
      if (link.type === 'positive' && isSameFusionPair(link.fromId, link.toId)) continue;

      for (const rule of CLEAN_LINK_MAP) {
        if (link.label && link.label.includes(rule.match)) {
          const key = `link_${rule.match}`;
          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            combos.push({
              id: key,
              icon: rule.icon,
              title: rule.title,
              badge: rule.badge,
              tier: rule.conflict ? 'conflict' : 'synergy'
            });
          }
          break;
        }
      }
    }

    return combos;
  }

  /**
   * Detecta:
   * 1) AGROSSISTEMAS 3x1 (Animal 1 + Animal 2 + Elemento Complementar conectados na mesa)
   * 2) MESCLAS DE POPULAÇÃO ANIMAL 2x1 (Mesmo Animal 1 + 2 juntos -> Rebanho / Bando / Vara Maior)
   * 3) MESCLAS COMPLEMENTARES 2x1 (Lavoura + Horta, Nascente + Açude, Animal + Infraestrutura)
   */
  computeCardFusions(cards) {
    const fusedCardIds = new Set();
    const fusions = [];

    // -------------------------------------------------------------------------
    // 1. RECEITAS DE AGROSSISTEMAS TRIPLOS (3 Cartas: Animal 1 + Animal 2 + Parceiro)
    // -------------------------------------------------------------------------
    const AGROSYSTEM_RECIPES = [
      {
        type: 'agrosystem_swine_biogas',
        label: '♻️ Agrossistema de Suinocultura & Bioenergia (3x1)',
        animalSubtype: 'pig',
        partnerMatch: c => c.subtype === 'biodigester'
      },
      {
        type: 'agrosystem_dairy_estate',
        label: '🐄 Agrossistema Leiteiro & Silagem (3x1)',
        animalSubtype: 'cow',
        partnerMatch: c => c.subtype === 'barn'
      },
      {
        type: 'agrosystem_cattle_biogas',
        label: '♻️ Agrossistema Pecuário de Bioenergia (3x1)',
        animalSubtype: 'cow',
        partnerMatch: c => c.subtype === 'biodigester'
      },
      {
        type: 'agrosystem_silvopasture',
        label: '🌳 Agrossistema Silvipastoril ILPF (3x1)',
        animalSubtype: 'cow',
        partnerMatch: c => c.type === 'tree'
      },
      {
        type: 'agrosystem_poultry_farm',
        label: '🥚 Agrossistema Avícola Caipira (3x1)',
        animalSubtype: 'chicken',
        partnerMatch: c => c.subtype === 'coop'
      },
      {
        type: 'agrosystem_agro_poultry',
        label: '🥬 Agrossistema de Horta & Avicultura (3x1)',
        animalSubtype: 'chicken',
        partnerMatch: c => c.type === 'crop' && (c.subtype === 'orchard' || c.subtype === 'grains')
      },
      {
        type: 'agrosystem_solar_mansion',
        label: '🏛️☀️ Casarão Colonial Fotovoltaico (3x1)',
        animalSubtype: 'farmhouse',
        partnerMatch: c => c.subtype === 'solar'
      },
      {
        type: 'agrosystem_solar_mansion',
        label: '🏛️☀️ Casarão & Usina Solar Fotovoltaica (3x1)',
        animalSubtype: 'solar',
        partnerMatch: c => c.subtype === 'farmhouse'
      },
      {
        type: 'agrosystem_solar_barn',
        label: '🏚️☀️ Complexo Agroindustrial Fotovoltaico (3x1)',
        animalSubtype: 'barn',
        partnerMatch: c => c.subtype === 'solar'
      },
      {
        type: 'agrosystem_solar_barn',
        label: '🏚️☀️ Complexo de Celeiro & Usina Solar (3x1)',
        animalSubtype: 'solar',
        partnerMatch: c => c.subtype === 'barn'
      },
      {
        type: 'agrosystem_dairy_estate',
        label: '🐄 Complexo de Celeiros & Pecuária Leiteira (3x1)',
        animalSubtype: 'barn',
        partnerMatch: c => c.subtype === 'cow'
      }
    ];

    const trioCandidates = [];
    for (const recipe of AGROSYSTEM_RECIPES) {
      const animals = cards.filter(c => c.subtype === recipe.animalSubtype);
      if (animals.length < 2) continue;
      const partners = cards.filter(recipe.partnerMatch);
      if (partners.length === 0) continue;

      for (let i = 0; i < animals.length; i++) {
        for (let j = i + 1; j < animals.length; j++) {
          const a1 = animals[i].id < animals[j].id ? animals[i] : animals[j];
          const a2 = animals[i].id < animals[j].id ? animals[j] : animals[i];

          for (const partner of partners) {
            const d12 = this.dist(a1, a2);
            const d1p = this.dist(a1, partner);
            const d2p = this.dist(a2, partner);
            const sortedDists = [d12, d1p, d2p].sort((x, y) => x - y);

            // As 3 cartas formam um componente conexo na mesa se as 2 menores arestas forem <= 2.65
            if (sortedDists[0] <= 2.65 && sortedDists[1] <= 2.65) {
              trioCandidates.push({
                id: `agro_${recipe.type}_${a1.id}_${a2.id}_${partner.id}`,
                type: recipe.type,
                label: recipe.label,
                scoreDist: sortedDists[0] + sortedDists[1],
                // Ordem padronizada: [Animal 1, Animal 2, Carta Parceira]
                members: [a1, a2, partner]
              });
            }
          }
        }
      }
    }

    trioCandidates.sort((x, y) => x.scoreDist - y.scoreDist);
    for (const trio of trioCandidates) {
      if (trio.members.some(m => fusedCardIds.has(m.id))) continue;
      for (const m of trio.members) fusedCardIds.add(m.id);
      fusions.push(trio);
    }

    // -------------------------------------------------------------------------
    // 2. RECEITAS DE MESCLAS DUPLAS (2x1: População Maior do Mesmo Animal & Pares Complementares)
    // -------------------------------------------------------------------------
    const PAIR_RECIPES = [
      // Mesclas do mesmo animal 1 + 2 -> População Maior!
      {
        type: 'herd_cow',
        label: '🐄 Rebanho Bovino (População Maior)',
        match: (a, b) => a.subtype === 'cow' && b.subtype === 'cow',
        order: (a, b) => (a.id < b.id ? [a, b] : [b, a])
      },
      {
        type: 'flock_chicken',
        label: '🐔 Bando de Galinhas Caipiras (População Maior)',
        match: (a, b) => a.subtype === 'chicken' && b.subtype === 'chicken',
        order: (a, b) => (a.id < b.id ? [a, b] : [b, a])
      },
      {
        type: 'herd_pig',
        label: '🐖 Vara de Suínos (População Maior)',
        match: (a, b) => a.subtype === 'pig' && b.subtype === 'pig',
        order: (a, b) => (a.id < b.id ? [a, b] : [b, a])
      },
      // Mesclas de infraestrutura 1 + 2 -> Casarão, Usina Solar e Complexo de Celeiros!
      {
        type: 'mansion_farmhouse',
        label: '🏛️ Casarão Colonial da Fazenda (2x1)',
        match: (a, b) => a.subtype === 'farmhouse' && b.subtype === 'farmhouse',
        order: (a, b) => (a.id < b.id ? [a, b] : [b, a])
      },
      {
        type: 'solar_park',
        label: '☀️ Usina Solar Fotovoltaica (2x1)',
        match: (a, b) => a.subtype === 'solar' && b.subtype === 'solar',
        order: (a, b) => (a.id < b.id ? [a, b] : [b, a])
      },
      {
        type: 'barn_complex',
        label: '🏚️ Complexo de Celeiros & Silos (2x1)',
        match: (a, b) => a.subtype === 'barn' && b.subtype === 'barn',
        order: (a, b) => (a.id < b.id ? [a, b] : [b, a])
      },
      {
        type: 'mega_solar_barn',
        label: '🏚️☀️ Celeiro Fotovoltaico (2x1)',
        match: (a, b) =>
          (a.subtype === 'barn' && b.subtype === 'solar') ||
          (a.subtype === 'solar' && b.subtype === 'barn'),
        order: (a, b) => (a.subtype === 'barn' ? [a, b] : [b, a])
      },
      // Mesclas de elementos complementares 2x1 (apenas lavouras reais: Plantação + Horta, nunca insumos!)
      {
        type: 'mega_crop',
        label: '🌾 Grande Lavoura Integrada (2x1)',
        match: (a, b) =>
          (a.subtype === 'grains' || a.subtype === 'orchard') &&
          (b.subtype === 'grains' || b.subtype === 'orchard'),
        order: (a, b) => (a.id < b.id ? [a, b] : [b, a])
      },
      {
        type: 'mega_watershed',
        label: '🏞️ Grande Lagoa & Cachoeira (2x1)',
        match: (a, b) =>
          (a.subtype === 'spring' && b.subtype === 'pond') ||
          (a.subtype === 'pond' && b.subtype === 'spring'),
        order: (a, b) => (a.subtype === 'spring' ? [a, b] : [b, a])
      },
      {
        type: 'mega_poultry',
        label: '🐔 Granja Avícola Caipira (2x1)',
        match: (a, b) =>
          (a.subtype === 'chicken' && b.subtype === 'coop') ||
          (a.subtype === 'coop' && b.subtype === 'chicken'),
        order: (a, b) => (a.subtype === 'coop' ? [a, b] : [b, a])
      },
      {
        type: 'mega_dairy',
        label: '🐄 Estância Leiteira Integrada (2x1)',
        match: (a, b) =>
          (a.subtype === 'cow' && b.subtype === 'barn') ||
          (a.subtype === 'barn' && b.subtype === 'cow'),
        order: (a, b) => (a.subtype === 'barn' ? [a, b] : [b, a])
      },
      {
        type: 'mega_biogas',
        label: '♻️ Usina Suinícola de Biogás (2x1)',
        match: (a, b) =>
          (a.subtype === 'pig' && b.subtype === 'biodigester') ||
          (a.subtype === 'biodigester' && b.subtype === 'pig'),
        order: (a, b) => (a.subtype === 'pig' ? [a, b] : [b, a])
      },
      {
        type: 'mega_solar_house',
        label: '☀️ Sede Rural Fotovoltaica (2x1)',
        match: (a, b) =>
          (a.subtype === 'farmhouse' && b.subtype === 'solar') ||
          (a.subtype === 'solar' && b.subtype === 'farmhouse'),
        order: (a, b) => (a.subtype === 'farmhouse' ? [a, b] : [b, a])
      }
    ];

    const pairCandidates = [];
    for (let i = 0; i < cards.length; i++) {
      for (let j = i + 1; j < cards.length; j++) {
        const a = cards[i];
        const b = cards[j];
        if (fusedCardIds.has(a.id) || fusedCardIds.has(b.id)) continue;

        const d = this.dist(a, b);
        if (d > 2.52) continue;

        for (const recipe of PAIR_RECIPES) {
          if (recipe.match(a, b)) {
            const ordered = recipe.order ? recipe.order(a, b) : a.id < b.id ? [a, b] : [b, a];
            pairCandidates.push({
              id: `fusion_${recipe.type}_${ordered[0].id}_${ordered[1].id}`,
              type: recipe.type,
              label: recipe.label,
              dist: d,
              members: ordered
            });
            break;
          }
        }
      }
    }

    pairCandidates.sort((x, y) => x.dist - y.dist);
    for (const cand of pairCandidates) {
      const [m1, m2] = cand.members;
      if (fusedCardIds.has(m1.id) || fusedCardIds.has(m2.id)) continue;
      fusedCardIds.add(m1.id);
      fusedCardIds.add(m2.id);
      fusions.push(cand);
    }

    return { fusions, fusedCardIds };
  }

  dist(a, b) {
    if (a.camPos && b.camPos) {
      return Math.hypot(a.camPos.x - b.camPos.x, a.camPos.y - b.camPos.y, a.camPos.z - b.camPos.z) / 1.35;
    }
    return Math.hypot(a.x - b.x, a.z - b.z);
  }

  decayWeight(d, maxR) {
    if (d >= maxR) return 0;
    const q = d / maxR;
    return 1 - q * q;
  }

  /**
   * Verifica geometricamente se existe uma carta de Árvore servindo de Barreira Vegetal / Quebra-Vento
   * ou Mata Ciliar interposta entre o ponto A (fonte poluidora) e o ponto B (receptor sensível).
   */
  hasBarrierBetween(a, b, treeCards) {
    const ax = a.x, az = a.z;
    const bx = b.x, bz = b.z;
    const dx = bx - ax;
    const dz = bz - az;
    const lenSq = dx * dx + dz * dz;
    if (lenSq < 1e-4) return false;

    for (const t of treeCards) {
      // Projeção escalar u do ponto T sobre o segmento AB
      const u = ((t.x - ax) * dx + (t.z - az) * dz) / lenSq;
      if (u > 0.1 && u < 0.9) {
        const px = ax + u * dx;
        const pz = az + u * dz;
        const perpDist = Math.hypot(t.x - px, t.z - pz);
        if (perpDist <= 1.25) return true;
      }
    }
    return false;
  }

  computeForestClusters(treeCards) {
    const n = treeCards.length;
    const visited = new Array(n).fill(false);
    const clusters = [];

    for (let i = 0; i < n; i++) {
      if (visited[i]) continue;
      const queue = [i];
      visited[i] = true;
      const members = [];

      while (queue.length > 0) {
        const curr = queue.shift();
        members.push(treeCards[curr]);
        for (let j = 0; j < n; j++) {
          if (!visited[j] && this.dist(treeCards[curr], treeCards[j]) <= DIST_THRESHOLDS.FOREST_CLUSTER) {
            visited[j] = true;
            queue.push(j);
          }
        }
      }

      const cx = members.reduce((s, m) => s + m.x, 0) / members.length;
      const cz = members.reduce((s, m) => s + m.z, 0) / members.length;
      const level = members.length === 1 ? 1 : members.length === 2 ? 2 : 3;

      clusters.push({
        id: `forest_${members.map(m => m.id).sort((a, b) => a - b).join('_')}`,
        level,
        count: members.length,
        centroid: { x: cx, z: cz },
        members
      });
    }

    return clusters;
  }
}

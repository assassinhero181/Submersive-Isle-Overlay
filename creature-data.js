"use strict";

/*
 * Species-derived creature data.
 * Evrima getplayerdata (0x77) returns the live creature class/stats and
 * mutation slots, but it does not return a bite-force or preferred-food
 * field. Those two UI fields therefore come from this class-keyed catalog.
 * Unknown species deliberately return null rather than showing invented data.
 * Bite-force stages are [juvenile-ish 25%, 50%, 75%, adult 100%].
 */
const CREATURE_DATA = {
  DEINOSUCHUS: {
    diet: "CARNIVORE",
    biteForceStages: [132, 275, 388, 500],
    preferredFood: {
      PROTEINS: ["Tenontosaurus", "Pachycephalosaurus", "Ceratosaurus"],
      CARBOHYDRATES: ["Carnotaurus", "Omniraptor", "Diabloceratops", "Deinosuchus", "Troodon", "Bullfrog"],
      LIPIDS: ["Elite Fish", "Gallimimus", "Stegosaurus", "Beipiaosaurus", "Maiasaura"]
    }
  },
  CERATOSAURUS: {
    diet: "CARNIVORE",
    biteForceStages: [27, 66, 108, 150],
    preferredFood: {
      PROTEINS: ["Tenontosaurus", "Pachycephalosaurus", "Ceratosaurus"],
      CARBOHYDRATES: ["Carnotaurus", "Deinosuchus", "Omniraptor", "Diabloceratops", "Deer"],
      LIPIDS: ["Dilophosaurus", "Stegosaurus", "Beipiaosaurus", "Goat"]
    }
  },
  CARNOTAURUS: {
    diet: "CARNIVORE",
    biteForceStages: [33, 78, 126, 175],
    preferredFood: { GENERAL: ["Small and medium prey", "Carcasses"] }
  },
  OMNIRAPTOR: {
    diet: "CARNIVORE",
    biteForceStages: [4, 18, 29, 65],
    preferredFood: {
      PROTEINS: ["Boar", "Herrerasaurus", "Pachycephalosaurus", "Ceratosaurus"],
      CARBOHYDRATES: ["Carnotaurus", "Diabloceratops", "Troodon", "Deer", "Rabbit"],
      LIPIDS: ["Dryosaurus", "Psittacosaurus", "Gallimimus", "Stegosaurus"]
    }
  },
  TROODON: {
    diet: "CARNIVORE",
    biteForceStages: [3, 8, 15, 15],
    preferredFood: { GENERAL: ["Small prey", "Carrion"] }
  },
  PTERANODON: {
    diet: "CARNIVORE",
    biteForceStages: [1, 7, 14, 20],
    preferredFood: { GENERAL: ["Fish", "Small prey", "Carrion"] }
  },
  DRYOSAURUS: {
    diet: "HERBIVORE",
    biteForceStages: [7, 13, 20, 20],
    preferredFood: { GENERAL: ["Foraged plants", "Diet plants"] }
  },
  HYPSILOPHODON: {
    diet: "HERBIVORE",
    biteForceStages: [2, 2, 2, 2],
    preferredFood: { GENERAL: ["Foraged plants", "Diet plants"] }
  },
  PACHYCEPHALOSAURUS: {
    diet: "HERBIVORE",
    biteForceStages: [2, 10, 20, 30],
    preferredFood: { GENERAL: ["Foraged plants", "Diet plants"] }
  },
  STEGOSAURUS: {
    diet: "HERBIVORE",
    biteForceStages: [10, 23, 37, 50],
    preferredFood: { GENERAL: ["Foraged plants", "Diet plants"] }
  },
  TENONTOSAURUS: {
    diet: "HERBIVORE",
    biteForceStages: [6, 14, 24, 35],
    preferredFood: { GENERAL: ["Foraged plants", "Diet plants"] }
  },
  BEIPIAOSAURUS: {
    diet: "OMNIVORE",
    biteForceStages: [7, 13, 20, 20],
    preferredFood: { GENERAL: ["Foraged plants", "Fish", "Small prey"] }
  },
  GALLIMIMUS: {
    diet: "OMNIVORE",
    biteForceStages: [4, 11, 18, 25],
    preferredFood: { GENERAL: ["Foraged plants", "Small prey", "Carrion"] }
  }
};

function getCreatureData(species) {
  let key = String(species || "")
    .trim()
    .toUpperCase();

  // Evrima/RCON may return Unreal class names such as BP_Deinosuchus_C.
  // Match the known species name anywhere in that class string.
  if (!CREATURE_DATA[key]) {
    const match = Object.keys(CREATURE_DATA).find(name =>
      key === name ||
      key.includes(name)
    );
    key = match || key;
  }

  return CREATURE_DATA[key] || null;
}

function biteForceForGrowth(species, growth) {
  const data = getCreatureData(species);
  if (!data || !Array.isArray(data.biteForceStages)) return null;
  const g = Number(growth);
  if (!Number.isFinite(g)) return data.biteForceStages[3] ?? null;
  const points = [25, 50, 75, 100];
  if (g <= 25) return data.biteForceStages[0];
  if (g >= 100) return data.biteForceStages[3];
  for (let i = 1; i < points.length; i++) {
    if (g <= points[i]) {
      const a = points[i - 1], b = points[i];
      const av = data.biteForceStages[i - 1], bv = data.biteForceStages[i];
      const t = (g - a) / (b - a);
      return av + ((bv - av) * t);
    }
  }
  return data.biteForceStages[3];
}

module.exports = { CREATURE_DATA, getCreatureData, biteForceForGrowth };

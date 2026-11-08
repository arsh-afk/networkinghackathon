export type RoleType = "artificer" | "broker" | "weaver" | "patron";

export interface RoleConfig {
  key: RoleType;
  name: string;
  color: string;
  glow: string;
  flavour: string;
  description: string;
  traits: string[];
}

export const ROLES: Record<RoleType, RoleConfig> = {
  artificer: {
    key: "artificer",
    name: "Artificer",
    color: "#6AA8FF",
    glow: "#2E6BFF",
    flavour: "Shaper of tools and hidden mechanisms",
    description: "You see the world as a complex machine waiting to be understood, repaired, and optimized.",
    traits: ["System Builder", "Logical Architect", "Bug Hunter", "Mechanism Crafter"],
  },
  broker: {
    key: "broker",
    name: "Broker",
    color: "#5FD08A",
    glow: "#12A15C",
    flavour: "Mover of resources, information and alliances",
    description: "You bridge the gap between disparate groups, turning networks into leverage and connections into ventures.",
    traits: ["Alliance Forger", "Resource Navigator", "Deal Maker", "Strategic Connector"],
  },
  weaver: {
    key: "weaver",
    name: "Weaver",
    color: "#FF9A57",
    glow: "#F2611B",
    flavour: "Crafter of narratives, symbols and feeling",
    description: "You shape the culture, design the experience, and craft the stories that make people care.",
    traits: ["Storyteller", "Experience Designer", "Symbol Maker", "Culture Shaper"],
  },
  patron: {
    key: "patron",
    name: "Patron",
    color: "#F0C766",
    glow: "#C9971F",
    flavour: "Holder of influence who tips the balance",
    description: "You hold seasoned perspective, guiding newcomers and tipping the scales of the gala through wisdom and presence.",
    traits: ["Influence Holder", "Mentor", "Scale Tipper", "Wise Counsel"],
  },
};

export const ROLE_KEYS: RoleType[] = ["artificer", "broker", "weaver", "patron"];

import { hostedRuleSnapshot, targetedHostedRuleSnapshot } from './hosted-rule-snapshot.js';
// Exact previous executable declarations; customized saved rules remain unchanged.
export const BUILTIN_EQUIPMENT_PREVIOUS_RULES = {
  "tt2-pearlbox": hostedRuleSnapshot("pearl-container"),
  "tt2-venomstaff": hostedRuleSnapshot("venom-staff"),
  "tt3-immortal-blade": hostedRuleSnapshot("immortal-blade"),
  "tt3-azure-sword": hostedRuleSnapshot("azure-sword"),
  "tt3-fate-wheel": hostedRuleSnapshot("fate-wheel"),
  "tt3-crimson-pouch": hostedRuleSnapshot("crimson-pouch"),
  "tt3-wolf-bow": hostedRuleSnapshot("wolf-bow"),
  "tt3-sapper-bomb": hostedRuleSnapshot("sapper-bomb"),
  "tt3-element-seal": hostedRuleSnapshot("element-seal"),
  "tt3-reverse-bow": hostedRuleSnapshot("reverse-bow"),
  "tt3eq-mistbox": hostedRuleSnapshot("cost-swap"),
  "tt8-demonslay": hostedRuleSnapshot("ranger-chain"),
  "tt8-heavensword": hostedRuleSnapshot("ranger-chain"),
  "tt7-naturestaff": hostedRuleSnapshot("nature-staff"),
  "tt7-darkfort": hostedRuleSnapshot("dark-fort"),
  "tt13-poor-meal": targetedHostedRuleSnapshot("batch13-poor-meal", "self"),
  "tt13-magazine": targetedHostedRuleSnapshot("batch13-magazine", "self"),
  "tt13-scale-armor": targetedHostedRuleSnapshot("batch13-scale-armor", "self"),
  "tt13-astrolabe": targetedHostedRuleSnapshot("batch13-astrolabe", "self")
};

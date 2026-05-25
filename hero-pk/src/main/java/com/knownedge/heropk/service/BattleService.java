package com.knownedge.heropk.service;

import com.knownedge.heropk.model.BattleRequest;
import com.knownedge.heropk.model.BattleResult;
import com.knownedge.heropk.model.Hero;
import com.knownedge.heropk.model.SecondaryStats;
import com.knownedge.heropk.model.Skill;
import com.knownedge.heropk.model.SkillCategory;
import com.knownedge.heropk.model.SkillType;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.stream.Collectors;

@Service
public class BattleService {

    private static final int SKILL_RELEASE_RAGE = 100;
    private static final int MAX_RAGE = 300;

    private final HeroDataService heroDataService;

    public BattleService(HeroDataService heroDataService) {
        this.heroDataService = heroDataService;
    }

    public BattleResult simulate(BattleRequest request) {
        Hero leftHero = heroDataService.getHero(request.getLeftHeroId());
        Hero rightHero = heroDataService.getHero(request.getRightHeroId());
        int maxRounds = request.getMaxRounds() == null ? 30 : Math.max(1, request.getMaxRounds());
        Random random = request.getSeed() == null ? new Random() : new Random(request.getSeed());

        Fighter left = new Fighter(leftHero);
        Fighter right = new Fighter(rightHero);

        applyPassive(left, left.hero.getPassive());
        applyPassive(right, right.hero.getPassive());

        BattleResult result = new BattleResult();
        result.setLeftHero(left.hero.getName());
        result.setRightHero(right.hero.getName());

        Fighter attacker = left;
        Fighter defender = right;

        for (int round = 1; round <= maxRounds; round++) {
            if (!left.alive() || !right.alive()) break;

            String turnStartDetail = attacker.applyTurnStartEffects();
            String stateTrigger = collectStateTriggers(attacker, defender);
            if (!stateTrigger.isEmpty()) {
                turnStartDetail = joinDetail(turnStartDetail, stateTrigger);
            }
            if (!turnStartDetail.isEmpty()) {
                log(result, round, attacker.hero.getName(), "状态结算", turnStartDetail, left, right);
            }
            if (!attacker.alive()) break;

            if (attacker.stunRounds > 0) {
                attacker.stunRounds--;
                log(result, round, attacker.hero.getName(), "眩晕", "被重击眩晕，跳过本回合行动", left, right);
                attacker.endTurn();
                Fighter tmp = attacker;
                attacker = defender;
                defender = tmp;
                continue;
            }

            ActionResult actionResult = act(attacker, defender, random);
            actionResult.detail = joinDetail(actionResult.detail, collectStateTriggers(attacker, defender));
            log(result, round, attacker.hero.getName(), actionResult.action, actionResult.detail, left, right);

            attacker.endTurn();
            if (!defender.alive()) break;

            Fighter tmp = attacker;
            attacker = defender;
            defender = tmp;
        }

        if (left.currentHp == right.currentHp) {
            result.setWinner("平局");
        } else {
            result.setWinner(left.currentHp > right.currentHp ? left.hero.getName() : right.hero.getName());
        }
        result.setRounds(result.getLogs().stream().map(BattleResult.RoundLog::getRound).max(Comparator.naturalOrder()).orElse(0));
        return result;
    }

    private ActionResult act(Fighter attacker, Fighter defender, Random random) {
        boolean trySkill = attacker.rage >= SKILL_RELEASE_RAGE && random.nextDouble() <= 0.25;
        if (trySkill) {
            Skill skill = chooseSkill(attacker, random);
            if (skill != null) {
                int rageCost = attacker.consumeRage(skill.getNeiliCost());

                if (skill.getType() == SkillType.ACTIVE_DAMAGE) {
                    AttackOutcome outcome = skillAttack(attacker, defender, skill, random);
                    String traitDetail = applyOffensiveTraits(attacker, defender, outcome, random);
                    attacker.setCooldown(skill);
                    int enemyRageGain = outcome.crit ? defender.gainRageOnCritTaken() : 0;
                    return new ActionResult(
                            "武功-伤害",
                            renderDamageDetail(outcome, skill.getName())
                                    + traitDetail
                                    + "，消耗怒气 " + rageCost + "（自身怒气 " + attacker.rage + "）"
                                    + (enemyRageGain > 0 ? "，对手受暴击怒气 +" + enemyRageGain + "（对手怒气 " + defender.rage + "）" : "")
                    );
                }

                if (skill.getType() == SkillType.ACTIVE_POISON) {
                    int poisonDamage = (int) Math.round(attacker.effectiveAttack() * skill.getPoisonRatio()) + skill.getPoisonFlat();
                    poisonDamage = Math.max(8, poisonDamage);
                    int duration = Math.max(2, skill.getDuration());
                    defender.applyPoison(poisonDamage, duration);
                    attacker.setCooldown(skill);
                    return new ActionResult(
                            "武功-中毒",
                            "发动「" + skill.getName() + "」，令对手中毒 " + duration + " 回合（每回合开始前掉血 " + poisonDamage + "）"
                                    + "，消耗怒气 " + rageCost + "（自身怒气 " + attacker.rage + "）"
                    );
                }

                if (skill.getType() == SkillType.ACTIVE_DEFENSE) {
                    attacker.applyBuff(skill.getBuffPercent(), skill.getDuration());
                    attacker.setCooldown(skill);
                    return new ActionResult(
                            "武功-防御",
                            "发动「" + skill.getName() + "」，提升 " + renderBuffs(skill.getBuffPercent())
                                    + "，持续 " + skill.getDuration() + " 回合"
                                    + "，消耗怒气 " + rageCost + "（自身怒气 " + attacker.rage + "）"
                    );
                }

                int heal = heal(attacker, skill);
                attacker.setCooldown(skill);
                return new ActionResult(
                        "武功-补血",
                        "发动「" + skill.getName() + "」，回复 " + heal + " 点生命"
                                + "，消耗怒气 " + rageCost + "（自身怒气 " + attacker.rage + "）"
                );
            }
        }

        String prefix = trySkill ? "怒气已达释放阈值但当前无可释放武功，" : "";
        AttackOutcome outcome = normalAttack(attacker, defender, random);
        String traitDetail = applyOffensiveTraits(attacker, defender, outcome, random);
        int selfRageGain = attacker.gainRageByDamage(outcome.damage);
        int enemyRageGain = outcome.crit ? defender.gainRageOnCritTaken() : 0;
        return new ActionResult(
                "普通攻击",
                prefix + renderDamageDetail(outcome, null)
                        + traitDetail
                        + "，自身怒气 +" + selfRageGain + "（自身怒气 " + attacker.rage + "）"
                        + (enemyRageGain > 0 ? "，对手受暴击怒气 +" + enemyRageGain + "（对手怒气 " + defender.rage + "）" : "")
        );
    }

    private String collectStateTriggers(Fighter attacker, Fighter defender) {
        List<String> parts = new ArrayList<String>();
        String a = attacker.consumeNearDeathTrigger();
        if (!a.isEmpty()) parts.add(attacker.hero.getName() + a);
        String d = defender.consumeNearDeathTrigger();
        if (!d.isEmpty()) parts.add(defender.hero.getName() + d);
        return String.join("；", parts);
    }

    private String joinDetail(String base, String extra) {
        if (extra == null || extra.isEmpty()) return base == null ? "" : base;
        if (base == null || base.isEmpty()) return extra;
        return base + "，" + extra;
    }

    private String applyOffensiveTraits(Fighter attacker, Fighter defender, AttackOutcome outcome, Random random) {
        if (!outcome.hit || outcome.damage <= 0 || !defender.alive()) {
            return "";
        }

        SecondaryStats sec = attacker.effectiveSecondary();
        List<String> parts = new ArrayList<String>();

        if (random.nextDouble() < clamp(sec.getComboRate(), 0.0, 0.40)) {
            AttackOutcome comboRoll = calculateDamage(attacker, defender, random,
                    attacker.effectiveAttack(), defender.effectiveDefense(), 0.45, 0.23, 0.14);
            if (comboRoll.hit && comboRoll.damage > 0) {
                int comboDamage = Math.max(1, (int) Math.round(comboRoll.damage * 0.5));
                defender.currentHp = Math.max(0, defender.currentHp - comboDamage);
                defender.tryTriggerNearDeath();
                parts.add("触发连击，追击伤害 " + comboRoll.damage + "，追加 " + comboDamage + " 点伤害");
            } else {
                parts.add("触发连击，但追击未命中");
            }
        }

        if (defender.alive() && random.nextDouble() < clamp(sec.getHeavyRate(), 0.0, 0.35)) {
            defender.stunRounds = Math.max(defender.stunRounds, 1);
            parts.add("触发重击，使对手眩晕 1 回合");
        }

        if (parts.isEmpty()) return "";
        return "，" + String.join("；", parts);
    }

    private Skill chooseSkill(Fighter fighter, Random random) {
        if (fighter.rage < SKILL_RELEASE_RAGE) {
            return null;
        }

        SkillCategory category = rollCategory(fighter, random);
        Skill firstTry = chooseUsableSkillByCategory(fighter, category, random);
        if (firstTry != null) return firstTry;

        List<SkillCategory> others = Arrays.asList(SkillCategory.DAMAGE, SkillCategory.DEFENSE, SkillCategory.HEAL)
                .stream().filter(c -> c != category).collect(Collectors.toList());
        SkillCategory retryCategory = others.get(random.nextInt(others.size()));
        return chooseUsableSkillByCategory(fighter, retryCategory, random);
    }

    private SkillCategory rollCategory(Fighter fighter, Random random) {
        double hp = fighter.currentHp;
        if (hp > 500) {
            return weightedCategory(random, 0.60, 0.25, 0.15);
        }
        if (hp > 300) {
            return weightedCategory(random, 0.30, 0.50, 0.20);
        }
        return weightedCategory(random, 0.15, 0.25, 0.60);
    }

    private SkillCategory weightedCategory(Random random, double damage, double defense, double heal) {
        double r = random.nextDouble();
        if (r < damage) return SkillCategory.DAMAGE;
        if (r < damage + defense) return SkillCategory.DEFENSE;
        return SkillCategory.HEAL;
    }

    private Skill chooseUsableSkillByCategory(Fighter fighter, SkillCategory category, Random random) {
        List<Skill> skills = fighter.hero.getSkills().stream()
                .filter(s -> s.getCategory() == category)
                .filter(fighter::isSkillUsable)
                .filter(fighter::canReleaseSkill)
            .collect(Collectors.toList());
        if (skills.isEmpty()) return null;
        return skills.get(random.nextInt(skills.size()));
    }

    private AttackOutcome normalAttack(Fighter attacker, Fighter defender, Random random) {
        return calculateAndApplyDamage(attacker, defender, random,
                attacker.effectiveAttack(), defender.effectiveDefense(), 0.45, 0.23, 0.14);
    }

    private AttackOutcome skillAttack(Fighter attacker, Fighter defender, Skill skill, Random random) {
        double atk = attacker.effectiveAttack();
        double inner = attacker.hero.getPrimary().getNeili();
        double defense = defender.effectiveDefense();
        double basePower = atk * (0.66 + skill.getDamageA() * 0.24) + inner * (0.16 + skill.getDamageB() * 0.20);
        double penetrate = clamp(skill.getDefensePenetration(), 0.0, 0.45);
        double effectiveDefense = defense * (0.62 - penetrate * 0.40);
        double floor = atk * 0.30 + inner * 0.10;
        double adjusted = Math.max(basePower, floor);
        return calculateAndApplyDamage(attacker, defender, random, adjusted, effectiveDefense, 0.62, 0.26, 0.24);
    }

    private AttackOutcome calculateAndApplyDamage(Fighter attacker, Fighter defender, Random random,
                                                  double attackValue, double defenseValue, double randomScale,
                                                  double minDamageRatio, double capRatio) {
        AttackOutcome outcome = calculateDamage(attacker, defender, random,
                attackValue, defenseValue, randomScale, minDamageRatio, capRatio);
        if (outcome.hit && outcome.damage > 0) {
            defender.currentHp = Math.max(0, defender.currentHp - outcome.damage);
            defender.tryTriggerNearDeath();
        }
        return outcome;
    }

    private AttackOutcome calculateDamage(Fighter attacker, Fighter defender, Random random,
                                          double attackValue, double defenseValue, double randomScale,
                                          double minDamageRatio, double capRatio) {
        SecondaryStats a = attacker.effectiveSecondary();
        SecondaryStats d = defender.effectiveSecondary();

        double hitChance = clamp(0.72 + (a.getHitRate() - d.getDodgeRate()) * 0.20, 0.35, 0.99);
        if (random.nextDouble() > hitChance) {
            return AttackOutcome.miss();
        }

        double randomFactor = 1 + ((random.nextDouble() * 0.12) - 0.06) * randomScale;
        double rolledAttack = attackValue * randomFactor;
        double mitigation = defenseValue > 0 ? defenseValue / (defenseValue + 260.0) : 0.0;
        double base = rolledAttack * (1 - mitigation * 0.90);
        base = Math.max(base, attackValue * minDamageRatio);

        double critChance = clamp(a.getCritRate() - d.getBlockRate() * 0.35, 0.02, 0.45);
        boolean crit = random.nextDouble() < critChance;
        if (crit) {
            base = base * clamp(a.getCritDamageRate(), 1.05, 1.60);
        }

        double blockChance = clamp(d.getBlockRate() - a.getHitRate() * 0.08 + 0.02, 0.03, 0.50);
        boolean block = random.nextDouble() < blockChance;
        if (block) {
            double blockReduce = clamp(0.12 + d.getBlockDamage() * 0.30, 0.08, 0.40);
            base = base * (1 - blockReduce);
        }

        double capped = Math.min(base, defender.maxHp * capRatio);
        int damage = (int) Math.max(1, Math.round(capped));
        return AttackOutcome.hit(damage, crit, block);
    }

    private String renderDamageDetail(AttackOutcome outcome, String skillName) {
        String prefix = skillName == null ? "" : ("发动「" + skillName + "」，");
        if (!outcome.hit) {
            return prefix + "未命中，造成 0 点伤害";
        }

        List<String> flags = new ArrayList<String>();
        if (outcome.crit) flags.add("暴击");
        if (outcome.block) flags.add("被格挡");
        if (flags.isEmpty()) {
            return prefix + "造成 " + outcome.damage + " 点伤害";
        }
        return prefix + "造成 " + outcome.damage + " 点伤害（" + String.join("，", flags) + "）";
    }

    private int heal(Fighter fighter, Skill skill) {
        int amount = (int) Math.round(fighter.maxHp * skill.getHealRatio()) + skill.getHealFlat();
        int before = fighter.currentHp;
        fighter.currentHp = Math.min(fighter.maxHp, fighter.currentHp + amount);
        return fighter.currentHp - before;
    }

    private void applyPassive(Fighter fighter, Skill passive) {
        if (passive == null || passive.getType() != SkillType.PASSIVE) return;
        fighter.applyBuff(passive.getBuffPercent(), passive.getDuration());
    }

    private void log(BattleResult result, int round, String actor, String action, String detail, Fighter left, Fighter right) {
        BattleResult.RoundLog log = new BattleResult.RoundLog();
        log.setRound(round);
        log.setActor(actor);
        log.setAction(action);
        log.setDetail(detail);
        log.setLeftHp(left.currentHp);
        log.setRightHp(right.currentHp);
        log.setLeftState(snapshot(left));
        log.setRightState(snapshot(right));
        result.getLogs().add(log);
    }

    private BattleResult.FighterState snapshot(Fighter f) {
        BattleResult.FighterState state = new BattleResult.FighterState();
        SecondaryStats sec = f.effectiveSecondary();
        state.setCurrentHp(f.currentHp);
        state.setMaxHp(f.maxHp);
        state.setRage(f.rage);
        state.setMaxRage(MAX_RAGE);
        state.setTili(f.hero.getPrimary().getTili());
        state.setWuli(f.hero.getPrimary().getWuli());
        state.setFangyu(f.hero.getPrimary().getFangyu());
        state.setNeili(f.hero.getPrimary().getNeili());
        state.setEffectiveAttack(f.effectiveAttack());
        state.setEffectiveDefense(f.effectiveDefense());
        state.setAttackBuffRate(f.buffOf("attack"));
        state.setDefenseBuffRate(f.buffOf("defense"));
        state.setCritBuffRate(f.buffOf("crit"));
        state.setCritDamageBuffRate(f.buffOf("critDamage"));
        state.setHitBuffRate(f.buffOf("hit"));
        state.setDodgeBuffRate(f.buffOf("dodge"));
        state.setBlockBuffRate(f.buffOf("block"));
        state.setBlockDamageBuffRate(f.buffOf("blockDamage"));
        state.setCritRate(sec.getCritRate());
        state.setCritDamageRate(sec.getCritDamageRate());
        state.setHitRate(sec.getHitRate());
        state.setDodgeRate(sec.getDodgeRate());
        state.setBlockRate(sec.getBlockRate());
        state.setBlockDamage(sec.getBlockDamage());
        state.setComboRate(sec.getComboRate());
        state.setHeavyRate(sec.getHeavyRate());
        state.setStunRounds(f.stunRounds);
        state.setPoisonRounds(f.poisonRounds());
        state.setNearDeathRounds(f.nearDeathRounds);
        state.setNearDeathUsed(f.nearDeathUsed);
        return state;
    }

    private String renderBuffs(Map<String, Double> buffs) {
        if (buffs == null || buffs.isEmpty()) return "无";
        List<String> parts = new ArrayList<String>();
        for (Map.Entry<String, Double> e : buffs.entrySet()) {
            parts.add(attrName(e.getKey()) + " +" + Math.round(e.getValue() * 100) + "%");
        }
        return String.join("，", parts);
    }

    private String attrName(String key) {
        if ("attack".equals(key)) return "攻击";
        if ("defense".equals(key)) return "防御";
        if ("hit".equals(key)) return "命中";
        if ("dodge".equals(key)) return "闪避";
        if ("block".equals(key)) return "格挡率";
        if ("blockDamage".equals(key)) return "格挡伤害";
        if ("crit".equals(key)) return "暴击率";
        if ("critDamage".equals(key)) return "暴击伤害";
        return key;
    }

    private double clamp(double v, double min, double max) {
        return Math.max(min, Math.min(max, v));
    }

    private static class ActionResult {
        String action;
        String detail;

        ActionResult(String action, String detail) {
            this.action = action;
            this.detail = detail;
        }
    }

    private static class AttackOutcome {
        boolean hit;
        int damage;
        boolean crit;
        boolean block;

        static AttackOutcome miss() {
            AttackOutcome outcome = new AttackOutcome();
            outcome.hit = false;
            outcome.damage = 0;
            return outcome;
        }

        static AttackOutcome hit(int damage, boolean crit, boolean block) {
            AttackOutcome outcome = new AttackOutcome();
            outcome.hit = true;
            outcome.damage = damage;
            outcome.crit = crit;
            outcome.block = block;
            return outcome;
        }
    }

    private static class Fighter {
        Hero hero;
        int maxHp;
        int currentHp;
        int rage;
        int stunRounds;
        int nearDeathRounds;
        boolean nearDeathUsed;
        String nearDeathTriggerMessage;
        Map<String, Integer> cooldowns = new HashMap<>();
        List<BuffState> buffs = new ArrayList<>();
        List<PoisonState> poisons = new ArrayList<>();

        Fighter(Hero hero) {
            this.hero = hero;
            // 体力算法：最大生命 = 体力 * 10（例：体力100 => 1000）
            this.maxHp = hero.getPrimary().getTili() * 10;
            this.currentHp = maxHp;
            this.rage = 0;
            this.stunRounds = 0;
            this.nearDeathRounds = 0;
            this.nearDeathUsed = false;
            this.nearDeathTriggerMessage = "";
        }

        boolean alive() {
            return currentHp > 0;
        }

        void setCooldown(Skill skill) {
            if (skill.getCooldown() > 0) {
                cooldowns.put(skill.getId(), skill.getCooldown());
            }
        }

        boolean isSkillUsable(Skill skill) {
            int cd = cooldowns.getOrDefault(skill.getId(), 0);
            return cd <= 0;
        }

        boolean canReleaseSkill(Skill skill) {
            return rage >= skill.getNeiliCost();
        }

        int consumeRage(int cost) {
            int realCost = Math.max(0, cost);
            int consumed = Math.min(realCost, rage);
            rage -= consumed;
            return consumed;
        }

        int gainRageByDamage(int damage) {
            if (damage <= 0) return 0;
            int gain = (int) Math.round(damage * 0.25);
            gain = Math.max(5, Math.min(40, gain));
            return addRage(gain);
        }

        int gainRageOnCritTaken() {
            return addRage(8);
        }

        int addRage(int value) {
            if (value <= 0) return 0;
            int before = rage;
            rage = Math.min(MAX_RAGE, rage + value);
            return rage - before;
        }

        void applyBuff(Map<String, Double> percent, int duration) {
            if (percent == null || percent.isEmpty() || duration <= 0) return;
            buffs.add(new BuffState(percent, duration));
        }

        void applyPoison(int damage, int rounds) {
            if (damage <= 0 || rounds <= 0) return;
            poisons.add(new PoisonState(damage, rounds));
        }

        String applyTurnStartEffects() {
            if (poisons.isEmpty()) return "";

            int totalDamage = 0;
            for (PoisonState p : poisons) {
                totalDamage += p.damage;
                p.rounds--;
            }
            poisons.removeIf(p -> p.rounds <= 0);

            if (totalDamage <= 0) return "";
            currentHp = Math.max(0, currentHp - totalDamage);
            tryTriggerNearDeath();
            return "中毒发作，回合开始前损失 " + totalDamage + " 点生命";
        }

        void tryTriggerNearDeath() {
            if (!hero.isNearDeathEnabled() || nearDeathUsed || !alive()) return;
            if (currentHp > (int) Math.floor(maxHp * 0.20)) return;
            nearDeathUsed = true;
            nearDeathRounds = 2;
            nearDeathTriggerMessage = "触发濒死状态（2回合）：基础暴击率/基础格挡率提升50%";
        }

        String consumeNearDeathTrigger() {
            String msg = nearDeathTriggerMessage;
            nearDeathTriggerMessage = "";
            return msg == null ? "" : msg;
        }

        int poisonRounds() {
            int max = 0;
            for (PoisonState p : poisons) {
                max = Math.max(max, p.rounds);
            }
            return max;
        }

        void endTurn() {
            cooldowns.replaceAll((k, v) -> Math.max(0, v - 1));
            cooldowns.entrySet().removeIf(e -> e.getValue() <= 0);
            for (BuffState buff : buffs) {
                buff.rounds--;
            }
            buffs.removeIf(b -> b.rounds <= 0);
            nearDeathRounds = Math.max(0, nearDeathRounds - 1);
        }

        SecondaryStats effectiveSecondary() {
            double baseCrit = hero.getSecondary().getCritRate();
            double baseBlock = hero.getSecondary().getBlockRate();
            double nearDeathCritBoost = nearDeathRounds > 0 ? baseCrit * 0.5 : 0.0;
            double nearDeathBlockBoost = nearDeathRounds > 0 ? baseBlock * 0.5 : 0.0;

            double crit = baseCrit + nearDeathCritBoost + buffOf("crit");
            double critDamage = hero.getSecondary().getCritDamageRate() + buffOf("critDamage");
            double hit = hero.getSecondary().getHitRate() + buffOf("hit");
            double dodge = hero.getSecondary().getDodgeRate() + buffOf("dodge");
            double block = baseBlock + nearDeathBlockBoost + buffOf("block");
            double blockDamage = hero.getSecondary().getBlockDamage() + buffOf("blockDamage");
            double combo = hero.getSecondary().getComboRate();
            double heavy = hero.getSecondary().getHeavyRate();
            return new SecondaryStats(crit, critDamage, hit, dodge, block, blockDamage, combo, heavy);
        }

        double effectiveAttack() {
            double base = 25 + 1.0 * hero.getPrimary().getWuli() + 0.6 * hero.getPrimary().getNeili();
            return base * (1 + buffOf("attack"));
        }

        double effectiveDefense() {
            double base = 20 + 0.9 * hero.getPrimary().getFangyu() + 0.45 * hero.getPrimary().getNeili();
            return base * (1 + buffOf("defense"));
        }

        double buffOf(String key) {
            return buffs.stream().mapToDouble(b -> b.percent.getOrDefault(key, 0.0)).sum();
        }
    }

    private static class BuffState {
        Map<String, Double> percent;
        int rounds;

        BuffState(Map<String, Double> percent, int rounds) {
            this.percent = percent;
            this.rounds = rounds;
        }
    }

    private static class PoisonState {
        int damage;
        int rounds;

        PoisonState(int damage, int rounds) {
            this.damage = damage;
            this.rounds = rounds;
        }
    }
}

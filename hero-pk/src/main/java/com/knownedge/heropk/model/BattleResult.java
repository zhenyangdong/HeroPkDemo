package com.knownedge.heropk.model;

import java.util.ArrayList;
import java.util.List;

public class BattleResult {
    private String leftHero;
    private String rightHero;
    private String winner;
    private int rounds;
    private String weatherCity;
    private String weatherCondition;
    private String weatherEffect;
    private double weatherAbilityMultiplier;
    private List<RoundLog> logs = new ArrayList<>();

    public String getLeftHero() { return leftHero; }
    public void setLeftHero(String leftHero) { this.leftHero = leftHero; }
    public String getRightHero() { return rightHero; }
    public void setRightHero(String rightHero) { this.rightHero = rightHero; }
    public String getWinner() { return winner; }
    public void setWinner(String winner) { this.winner = winner; }
    public int getRounds() { return rounds; }
    public void setRounds(int rounds) { this.rounds = rounds; }
    public String getWeatherCity() { return weatherCity; }
    public void setWeatherCity(String weatherCity) { this.weatherCity = weatherCity; }
    public String getWeatherCondition() { return weatherCondition; }
    public void setWeatherCondition(String weatherCondition) { this.weatherCondition = weatherCondition; }
    public String getWeatherEffect() { return weatherEffect; }
    public void setWeatherEffect(String weatherEffect) { this.weatherEffect = weatherEffect; }
    public double getWeatherAbilityMultiplier() { return weatherAbilityMultiplier; }
    public void setWeatherAbilityMultiplier(double weatherAbilityMultiplier) { this.weatherAbilityMultiplier = weatherAbilityMultiplier; }
    public List<RoundLog> getLogs() { return logs; }
    public void setLogs(List<RoundLog> logs) { this.logs = logs; }

    public static class RoundLog {
        private int round;
        private String actor;
        private String action;
        private String detail;
        private int leftHp;
        private int rightHp;
        private FighterState leftState;
        private FighterState rightState;

        public int getRound() { return round; }
        public void setRound(int round) { this.round = round; }
        public String getActor() { return actor; }
        public void setActor(String actor) { this.actor = actor; }
        public String getAction() { return action; }
        public void setAction(String action) { this.action = action; }
        public String getDetail() { return detail; }
        public void setDetail(String detail) { this.detail = detail; }
        public int getLeftHp() { return leftHp; }
        public void setLeftHp(int leftHp) { this.leftHp = leftHp; }
        public int getRightHp() { return rightHp; }
        public void setRightHp(int rightHp) { this.rightHp = rightHp; }
        public FighterState getLeftState() { return leftState; }
        public void setLeftState(FighterState leftState) { this.leftState = leftState; }
        public FighterState getRightState() { return rightState; }
        public void setRightState(FighterState rightState) { this.rightState = rightState; }
    }

    public static class FighterState {
        private int currentHp;
        private int maxHp;
        private int rage;
        private int maxRage;
        private int tili;
        private int wuli;
        private int fangyu;
        private int neili;
        private double effectiveAttack;
        private double effectiveDefense;
        private double attackBuffRate;
        private double defenseBuffRate;
        private double critBuffRate;
        private double critDamageBuffRate;
        private double hitBuffRate;
        private double dodgeBuffRate;
        private double blockBuffRate;
        private double blockDamageBuffRate;
        private double critRate;
        private double critDamageRate;
        private double hitRate;
        private double dodgeRate;
        private double blockRate;
        private double blockDamage;
        private double comboRate;
        private double heavyRate;
        private int stunRounds;
        private int poisonRounds;
        private int nearDeathRounds;
        private boolean nearDeathUsed;
        private double weatherAbilityMultiplier;

        public int getCurrentHp() { return currentHp; }
        public void setCurrentHp(int currentHp) { this.currentHp = currentHp; }
        public int getMaxHp() { return maxHp; }
        public void setMaxHp(int maxHp) { this.maxHp = maxHp; }
        public int getRage() { return rage; }
        public void setRage(int rage) { this.rage = rage; }
        public int getMaxRage() { return maxRage; }
        public void setMaxRage(int maxRage) { this.maxRage = maxRage; }
        public int getTili() { return tili; }
        public void setTili(int tili) { this.tili = tili; }
        public int getWuli() { return wuli; }
        public void setWuli(int wuli) { this.wuli = wuli; }
        public int getFangyu() { return fangyu; }
        public void setFangyu(int fangyu) { this.fangyu = fangyu; }
        public int getNeili() { return neili; }
        public void setNeili(int neili) { this.neili = neili; }
        public double getEffectiveAttack() { return effectiveAttack; }
        public void setEffectiveAttack(double effectiveAttack) { this.effectiveAttack = effectiveAttack; }
        public double getEffectiveDefense() { return effectiveDefense; }
        public void setEffectiveDefense(double effectiveDefense) { this.effectiveDefense = effectiveDefense; }
        public double getAttackBuffRate() { return attackBuffRate; }
        public void setAttackBuffRate(double attackBuffRate) { this.attackBuffRate = attackBuffRate; }
        public double getDefenseBuffRate() { return defenseBuffRate; }
        public void setDefenseBuffRate(double defenseBuffRate) { this.defenseBuffRate = defenseBuffRate; }
        public double getCritBuffRate() { return critBuffRate; }
        public void setCritBuffRate(double critBuffRate) { this.critBuffRate = critBuffRate; }
        public double getCritDamageBuffRate() { return critDamageBuffRate; }
        public void setCritDamageBuffRate(double critDamageBuffRate) { this.critDamageBuffRate = critDamageBuffRate; }
        public double getHitBuffRate() { return hitBuffRate; }
        public void setHitBuffRate(double hitBuffRate) { this.hitBuffRate = hitBuffRate; }
        public double getDodgeBuffRate() { return dodgeBuffRate; }
        public void setDodgeBuffRate(double dodgeBuffRate) { this.dodgeBuffRate = dodgeBuffRate; }
        public double getBlockBuffRate() { return blockBuffRate; }
        public void setBlockBuffRate(double blockBuffRate) { this.blockBuffRate = blockBuffRate; }
        public double getBlockDamageBuffRate() { return blockDamageBuffRate; }
        public void setBlockDamageBuffRate(double blockDamageBuffRate) { this.blockDamageBuffRate = blockDamageBuffRate; }
        public double getCritRate() { return critRate; }
        public void setCritRate(double critRate) { this.critRate = critRate; }
        public double getCritDamageRate() { return critDamageRate; }
        public void setCritDamageRate(double critDamageRate) { this.critDamageRate = critDamageRate; }
        public double getHitRate() { return hitRate; }
        public void setHitRate(double hitRate) { this.hitRate = hitRate; }
        public double getDodgeRate() { return dodgeRate; }
        public void setDodgeRate(double dodgeRate) { this.dodgeRate = dodgeRate; }
        public double getBlockRate() { return blockRate; }
        public void setBlockRate(double blockRate) { this.blockRate = blockRate; }
        public double getBlockDamage() { return blockDamage; }
        public void setBlockDamage(double blockDamage) { this.blockDamage = blockDamage; }
        public double getComboRate() { return comboRate; }
        public void setComboRate(double comboRate) { this.comboRate = comboRate; }
        public double getHeavyRate() { return heavyRate; }
        public void setHeavyRate(double heavyRate) { this.heavyRate = heavyRate; }
        public int getStunRounds() { return stunRounds; }
        public void setStunRounds(int stunRounds) { this.stunRounds = stunRounds; }
        public int getPoisonRounds() { return poisonRounds; }
        public void setPoisonRounds(int poisonRounds) { this.poisonRounds = poisonRounds; }
        public int getNearDeathRounds() { return nearDeathRounds; }
        public void setNearDeathRounds(int nearDeathRounds) { this.nearDeathRounds = nearDeathRounds; }
        public boolean isNearDeathUsed() { return nearDeathUsed; }
        public void setNearDeathUsed(boolean nearDeathUsed) { this.nearDeathUsed = nearDeathUsed; }
        public double getWeatherAbilityMultiplier() { return weatherAbilityMultiplier; }
        public void setWeatherAbilityMultiplier(double weatherAbilityMultiplier) { this.weatherAbilityMultiplier = weatherAbilityMultiplier; }
    }
}

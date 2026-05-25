package com.knownedge.heropk.model;

import java.util.HashMap;
import java.util.Map;

public class Skill {
    private String id;
    private String name;
    private SkillCategory category;
    private SkillType type;
    private int cooldown;
    private int neiliCost;
    private double damageA;
    private double damageB;
    private double defensePenetration;
    private double healRatio;
    private int healFlat;
    private double poisonRatio;
    private int poisonFlat;
    private int duration;
    private Map<String, Double> buffPercent = new HashMap<>();

    public String getId() { return id; }
    public Skill setId(String id) { this.id = id; return this; }
    public String getName() { return name; }
    public Skill setName(String name) { this.name = name; return this; }
    public SkillCategory getCategory() { return category; }
    public Skill setCategory(SkillCategory category) { this.category = category; return this; }
    public SkillType getType() { return type; }
    public Skill setType(SkillType type) { this.type = type; return this; }
    public int getCooldown() { return cooldown; }
    public Skill setCooldown(int cooldown) { this.cooldown = cooldown; return this; }
    public int getNeiliCost() { return neiliCost; }
    public Skill setNeiliCost(int neiliCost) { this.neiliCost = neiliCost; return this; }
    public double getDamageA() { return damageA; }
    public Skill setDamageA(double damageA) { this.damageA = damageA; return this; }
    public double getDamageB() { return damageB; }
    public Skill setDamageB(double damageB) { this.damageB = damageB; return this; }
    public double getDefensePenetration() { return defensePenetration; }
    public Skill setDefensePenetration(double defensePenetration) { this.defensePenetration = defensePenetration; return this; }
    public double getHealRatio() { return healRatio; }
    public Skill setHealRatio(double healRatio) { this.healRatio = healRatio; return this; }
    public int getHealFlat() { return healFlat; }
    public Skill setHealFlat(int healFlat) { this.healFlat = healFlat; return this; }
    public double getPoisonRatio() { return poisonRatio; }
    public Skill setPoisonRatio(double poisonRatio) { this.poisonRatio = poisonRatio; return this; }
    public int getPoisonFlat() { return poisonFlat; }
    public Skill setPoisonFlat(int poisonFlat) { this.poisonFlat = poisonFlat; return this; }
    public int getDuration() { return duration; }
    public Skill setDuration(int duration) { this.duration = duration; return this; }
    public Map<String, Double> getBuffPercent() { return buffPercent; }
    public Skill setBuffPercent(Map<String, Double> buffPercent) { this.buffPercent = buffPercent; return this; }
}

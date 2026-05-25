package com.knownedge.heropk.model;

import java.util.ArrayList;
import java.util.List;

public class Hero {
    private String id;
    private String name;
    private String title;
    private boolean nearDeathEnabled;
    private PrimaryStats primary;
    private SecondaryStats secondary;
    private List<Skill> skills = new ArrayList<>();
    private Skill passive;

    public String getId() { return id; }
    public Hero setId(String id) { this.id = id; return this; }
    public String getName() { return name; }
    public Hero setName(String name) { this.name = name; return this; }
    public String getTitle() { return title; }
    public Hero setTitle(String title) { this.title = title; return this; }
    public boolean isNearDeathEnabled() { return nearDeathEnabled; }
    public Hero setNearDeathEnabled(boolean nearDeathEnabled) { this.nearDeathEnabled = nearDeathEnabled; return this; }
    public PrimaryStats getPrimary() { return primary; }
    public Hero setPrimary(PrimaryStats primary) { this.primary = primary; return this; }
    public SecondaryStats getSecondary() { return secondary; }
    public Hero setSecondary(SecondaryStats secondary) { this.secondary = secondary; return this; }
    public List<Skill> getSkills() { return skills; }
    public Hero setSkills(List<Skill> skills) { this.skills = skills; return this; }
    public Skill getPassive() { return passive; }
    public Hero setPassive(Skill passive) { this.passive = passive; return this; }
}

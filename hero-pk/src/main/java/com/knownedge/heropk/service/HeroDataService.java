package com.knownedge.heropk.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.knownedge.heropk.model.Hero;
import com.knownedge.heropk.model.PrimaryStats;
import com.knownedge.heropk.model.SecondaryStats;
import com.knownedge.heropk.model.Skill;
import com.knownedge.heropk.model.SkillCategory;
import com.knownedge.heropk.model.SkillType;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class HeroDataService {

    private final Map<String, Hero> heroMap;
    private final ObjectMapper objectMapper;
    private final SkillTemplateConfig skillTemplateConfig;
    private final List<RageCostTier> rageCostTiers;
    private final int defaultRageCost;

    public HeroDataService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
        this.skillTemplateConfig = loadSkillTemplateConfig();
        this.rageCostTiers = new ArrayList<>(this.skillTemplateConfig.rageCostTiers);
        this.rageCostTiers.sort(Comparator.comparingInt((RageCostTier t) -> t.legacyMin).reversed());
        this.defaultRageCost = this.skillTemplateConfig.defaultRageCost;
        this.heroMap = buildHeroes();
    }

    public List<Hero> allHeroes() {
        return new ArrayList<>(heroMap.values());
    }

    public Hero getHero(String id) {
        Hero h = heroMap.get(id);
        if (h == null) {
            throw new IllegalArgumentException("未知角色: " + id);
        }
        return h;
    }

    private Map<String, Hero> buildHeroes() {
        Map<String, Hero> m = new HashMap<>();

        List<HeroSeed> seeds = loadHeroSeeds();
        for (HeroSeed seed : seeds) {
            if (seed == null) continue;
            String style = seed.style == null ? "assassin" : seed.style;
            Hero h = autoHero(seed.id, seed.name, seed.title,
                    p(seed.primary.tili, seed.primary.wuli, seed.primary.fangyu, seed.primary.neili),
                    s(seed.secondary.critRate, seed.secondary.critDamageRate, seed.secondary.hitRate,
                            seed.secondary.dodgeRate, seed.secondary.blockRate, seed.secondary.blockDamage),
                    style,
                    seed.nearDeathEnabled);
            m.put(seed.id, h);
        }

        return m;
    }

    private SkillTemplateConfig loadSkillTemplateConfig() {
        try {
            ClassPathResource resource = new ClassPathResource("config/skill-templates.json");
            SkillTemplateConfig cfg = objectMapper.readValue(resource.getInputStream(), SkillTemplateConfig.class);
            if (cfg == null || cfg.styles == null || cfg.styles.isEmpty()) {
                throw new IllegalStateException("skill-templates.json 未配置 styles");
            }
            if (cfg.defaultStyle == null || cfg.defaultStyle.isEmpty()) {
                cfg.defaultStyle = "assassin";
            }
            if (cfg.rageCostTiers == null) {
                cfg.rageCostTiers = Collections.emptyList();
            }
            return cfg;
        } catch (IOException e) {
            throw new IllegalStateException("加载武功模板配置失败: config/skill-templates.json", e);
        }
    }

    private List<HeroSeed> loadHeroSeeds() {
        try {
            ClassPathResource resource = new ClassPathResource("config/heroes.json");
            return objectMapper.readValue(resource.getInputStream(), new TypeReference<List<HeroSeed>>() {
            });
        } catch (IOException e) {
            throw new IllegalStateException("加载角色配置失败: config/heroes.json", e);
        }
    }

    private Hero autoHero(String id, String name, String title,
                          PrimaryStats p, SecondaryStats s,
                          String style, boolean nearDeathEnabled) {
        Hero h = hero(id, name, title, p, s, autoSkills(name, style), autoPassive(name, style));
        if (nearDeathEnabled) {
            h.setNearDeathEnabled(true);
        }
        return h;
    }

    private List<Skill> autoSkills(String heroName, String style) {
        StyleTemplate styleTemplate = resolveStyleTemplate(style);
        List<Skill> skills = new ArrayList<>();
        for (SkillTemplate t : styleTemplate.activeSkills) {
            skills.add(toSkill(heroName, t));
        }
        return skills;
    }

    private Skill autoPassive(String heroName, String style) {
        StyleTemplate styleTemplate = resolveStyleTemplate(style);
        return toSkill(heroName, styleTemplate.passive);
    }

    private StyleTemplate resolveStyleTemplate(String style) {
        String resolved = (style == null || style.isEmpty()) ? skillTemplateConfig.defaultStyle : style;
        StyleTemplate t = skillTemplateConfig.styles.get(resolved);
        if (t == null) {
            t = skillTemplateConfig.styles.get(skillTemplateConfig.defaultStyle);
        }
        if (t == null) {
            throw new IllegalStateException("未找到可用武功风格模板: " + resolved);
        }
        return t;
    }

    private Skill toSkill(String heroName, SkillTemplate t) {
        SkillType skillType = SkillType.valueOf(t.type);
        SkillCategory category = SkillCategory.valueOf(t.category);

        Skill s = new Skill()
                .setId(skillName(heroName, t.name))
                .setName(skillName(heroName, t.name))
                .setType(skillType)
                .setCategory(category)
                .setCooldown(t.cooldown)
                .setNeiliCost(toRageCost(t.cost))
                .setDuration(t.duration);

        if (skillType == SkillType.ACTIVE_DAMAGE) {
            s.setDamageA(t.damageA).setDamageB(t.damageB).setDefensePenetration(t.defensePenetration);
        } else if (skillType == SkillType.ACTIVE_HEAL) {
            s.setHealRatio(t.healRatio).setHealFlat(t.healFlat);
        } else if (skillType == SkillType.ACTIVE_POISON) {
            s.setPoisonRatio(t.poisonRatio).setPoisonFlat(t.poisonFlat);
        }

        if (t.buffs != null) {
            s.setBuffPercent(new HashMap<>(t.buffs));
        }
        return s;
    }

    private String skillName(String heroName, String skill) {
        return heroName + "·" + skill;
    }

    private Hero hero(String id, String name, String title,
                      PrimaryStats p, SecondaryStats s, List<Skill> skills, Skill passive) {
        return new Hero()
                .setId(id)
                .setName(name)
                .setTitle(title)
                .setPrimary(p)
                .setSecondary(s)
                .setSkills(skills)
                .setPassive(passive);
    }

    private PrimaryStats p(int tili, int wuli, int fangyu, int neili) {
        return new PrimaryStats(tili, wuli, fangyu, neili);
    }

    private SecondaryStats s(double critRate, double critDamageRate, double hitRate,
                             double dodgeRate, double blockRate, double blockDamage) {
                double comboRate = clamp(0.08 + dodgeRate * 0.35 + critRate * 0.15, 0.08, 0.22);
                double heavyRate = clamp(0.06 + blockRate * 0.35 + critRate * 0.10, 0.06, 0.18);
                return new SecondaryStats(critRate, critDamageRate, hitRate, dodgeRate, blockRate, blockDamage, comboRate, heavyRate);
    }

    private int toRageCost(int legacyCost) {
        for (RageCostTier tier : rageCostTiers) {
            if (legacyCost >= tier.legacyMin) {
                return tier.rageCost;
            }
        }
        return defaultRageCost;
    }

        private double clamp(double v, double min, double max) {
                return Math.max(min, Math.min(max, v));
        }

    private static class HeroSeed {
        public String id;
        public String name;
        public String title;
        public String style;
        public boolean nearDeathEnabled;
        public PrimarySeed primary;
        public SecondarySeed secondary;
    }

    private static class PrimarySeed {
        public int tili;
        public int wuli;
        public int fangyu;
        public int neili;
    }

    private static class SecondarySeed {
        public double critRate;
        public double critDamageRate;
        public double hitRate;
        public double dodgeRate;
        public double blockRate;
        public double blockDamage;
    }

    private static class SkillTemplateConfig {
        public String defaultStyle;
        public int defaultRageCost = 100;
        public List<RageCostTier> rageCostTiers = Collections.emptyList();
        public Map<String, StyleTemplate> styles = new HashMap<>();
    }

    private static class RageCostTier {
        public int legacyMin;
        public int rageCost;
    }

    private static class StyleTemplate {
        public List<SkillTemplate> activeSkills = Collections.emptyList();
        public SkillTemplate passive;
    }

    private static class SkillTemplate {
        public String name;
        public String type;
        public String category;
        public int cooldown;
        public int cost;
        public int duration;
        public double damageA;
        public double damageB;
        public double defensePenetration;
        public double healRatio;
        public int healFlat;
        public double poisonRatio;
        public int poisonFlat;
        public Map<String, Double> buffs;
    }
}

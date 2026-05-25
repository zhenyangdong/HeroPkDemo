package com.knownedge.heropk.service;

import com.knownedge.heropk.model.Hero;
import com.knownedge.heropk.model.PrimaryStats;
import com.knownedge.heropk.model.SecondaryStats;
import com.knownedge.heropk.model.Skill;
import com.knownedge.heropk.model.SkillCategory;
import com.knownedge.heropk.model.SkillType;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class HeroDataService {

    private final Map<String, Hero> heroMap;

    public HeroDataService() {
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

        m.put("guojing", hero("guojing", "郭靖", "均衡战士",
                p(98, 96, 97, 95), s(0.22, 1.00, 0.84, 0.06, 0.18, 0.32),
                list(
                        dmg("降龙十八掌", 2, 20, 1.75, 0.85, 0.15),
                        dmg("亢龙有悔", 2, 18, 1.55, 0.70, 0.10),
                        def("金雁护体", 3, 16, 2, map("defense", 0.22, "block", 0.10)),
                        heal("九阴真经调息", 3, 18, 0.18, 30)
                ),
                passive("侠之大者", 4, map("attack", 0.08, "defense", 0.08))
        ).setNearDeathEnabled(true));

        m.put("yangguo", hero("yangguo", "杨过", "爆发刺客",
                p(88, 99, 82, 94), s(0.30, 1.15, 0.83, 0.09, 0.12, 0.24),
                list(
                        dmg("黯然销魂掌", 3, 22, 2.10, 0.90, 0.10),
                        dmg("玄铁重斩", 2, 18, 1.75, 0.75, 0.12),
                        def("玄铁剑势", 3, 15, 2, map("defense", 0.18, "blockDamage", 0.20))
                ),
                passive("独臂绝境", 3, map("crit", 0.10))
        ).setNearDeathEnabled(true));

        m.put("qiaofeng", hero("qiaofeng", "乔峰", "高攻压制",
                p(100, 100, 100, 100), s(0.25, 1.00, 0.85, 0.05, 0.15, 0.30),
                list(
                        dmg("降龙廿八劲", 2, 21, 1.95, 0.80, 0.20),
                        dmg("擒龙重击", 2, 18, 1.70, 0.65, 0.15),
                        dmg("震岳掌", 3, 23, 2.10, 0.70, 0.10),
                        def("擒龙御劲", 3, 15, 2, map("defense", 0.20, "hit", 0.10))
                ),
                passive("丐帮帮主气魄", 4, map("critDamage", 0.20))
        ).setNearDeathEnabled(true));

        m.put("linghuchong", hero("linghuchong", "令狐冲", "反制剑客",
                p(86, 94, 85, 97), s(0.27, 0.95, 0.88, 0.10, 0.13, 0.26),
                list(
                        dmg("独孤九剑", 2, 19, 1.70, 1.00, 0.25),
                        poison("夺命连刺", 3, 20, 3, 0.16, 22),
                        def("破招回风", 3, 15, 1, map("defense", 0.16)),
                        heal("吸星归元", 3, 12, 0.12, 80),
                        heal("易筋经", 4, 18, 0.18, 100)
                ),
                passive("笑傲江湖", 4, map("dodge", 0.10, "hit", 0.08))
        ));

        m.put("zhangwuji", hero("zhangwuji", "张无忌", "内功续航",
                p(99, 90, 95, 100), s(0.20, 0.85, 0.84, 0.07, 0.18, 0.35),
                list(
                        dmg("乾坤一击", 2, 20, 1.65, 1.20, 0.10),
                        def("乾坤挪移", 3, 18, 2, map("defense", 0.15, "block", 0.08)),
                        heal("九阳真愈", 4, 22, 0.22, 40),
                        heal("真气续命", 4, 20, 0.15, 120)
                ),
                passive("九阳不绝", 5, map("defense", 0.05, "hit", 0.03))
        ).setNearDeathEnabled(true));

        m.put("weixiaobao", hero("weixiaobao", "韦小宝", "机变干扰",
                p(72, 76, 70, 82), s(0.18, 0.70, 0.90, 0.14, 0.10, 0.20),
                list(
                        dmg("神行偷袭", 2, 13, 1.45, 0.70, 0.05),
                        def("金丝软甲", 3, 12, 2, map("defense", 0.16, "dodge", 0.12)),
                        def("迷踪闪避", 3, 14, 1, map("dodge", 0.18)),
                        heal("太医秘药", 3, 14, 0.20, 60)
                ),
                passive("福缘护身", 4, map("block", 0.08))
        ));

        m.put("xiaolongnv", hero("xiaolongnv", "小龙女", "敏捷控制",
                p(84, 92, 83, 96), s(0.26, 0.92, 0.87, 0.13, 0.11, 0.22),
                list(
                        dmg("玉女素心剑", 2, 18, 1.72, 0.88, 0.12),
                        dmg("冷月剑影", 2, 16, 1.60, 0.70, 0.10),
                        def("天罗步影", 3, 15, 2, map("dodge", 0.20, "defense", 0.10))
                ),
                passive("古墓清心", 4, map("hit", 0.08, "dodge", 0.08))
        ));

        m.put("huangrong", hero("huangrong", "黄蓉", "智谋辅助",
                p(82, 85, 80, 98), s(0.23, 0.80, 0.92, 0.11, 0.12, 0.24),
                list(
                        dmg("打狗棒法", 2, 17, 1.62, 0.92, 0.18),
                        poison("软猬毒针", 3, 18, 3, 0.14, 26),
                        def("兰花拂穴手", 3, 15, 2, map("defense", 0.14, "dodge", 0.06)),
                        def("桃花迷阵", 3, 16, 1, map("block", 0.10, "dodge", 0.08)),
                        heal("桃花回春", 3, 14, 0.15, 120)
                ),
                passive("机巧百变", 4, map("hit", 0.05, "crit", 0.05))
        ));

        m.put("wangchongyang", hero("wangchongyang", "王重阳", "宗师稳压",
                p(96, 97, 98, 99), s(0.24, 0.98, 0.89, 0.08, 0.19, 0.36),
                list(
                        dmg("先天剑气", 2, 20, 1.80, 1.05, 0.22),
                        def("先天罡壁", 3, 18, 2, map("defense", 0.24, "block", 0.12)),
                        def("重阳护罡", 3, 16, 1, map("defense", 0.16, "blockDamage", 0.12)),
                        heal("全真归息", 4, 19, 0.18, 90)
                ),
                passive("中神通", 4, map("attack", 0.10, "defense", 0.10))
        ));

        m.put("dongfang", hero("dongfang", "东方不败", "极速爆发",
                p(85, 100, 82, 100), s(0.35, 1.25, 0.93, 0.16, 0.09, 0.18),
                list(
                        dmg("葵花神针", 3, 23, 2.00, 1.10, 0.10),
                        dmg("流光绝刺", 2, 20, 1.90, 0.85, 0.08),
                        poison("绣针蚀骨", 3, 20, 3, 0.18, 30),
                        dmg("飞花追命", 3, 24, 2.15, 0.90, 0.12),
                        def("残影护身", 3, 17, 2, map("dodge", 0.22, "defense", 0.08))
                ),
                passive("葵花极意", 3, map("crit", 0.10, "hit", 0.05))
        ));

        return m;
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

    private Skill dmg(String name, int cd, int cost, double a, double b, double p) {
        return new Skill()
                .setId(name)
                .setName(name)
                .setType(SkillType.ACTIVE_DAMAGE)
                .setCategory(SkillCategory.DAMAGE)
                .setCooldown(cd)
                                .setNeiliCost(toRageCost(cost))
                .setDamageA(a)
                .setDamageB(b)
                .setDefensePenetration(p);
    }

    private Skill def(String name, int cd, int cost, int duration, Map<String, Double> buffs) {
        return new Skill()
                .setId(name)
                .setName(name)
                .setType(SkillType.ACTIVE_DEFENSE)
                .setCategory(SkillCategory.DEFENSE)
                .setCooldown(cd)
                                .setNeiliCost(toRageCost(cost))
                .setDuration(duration)
                .setBuffPercent(buffs);
    }

    private Skill heal(String name, int cd, int cost, double ratio, int flat) {
        return new Skill()
                .setId(name)
                .setName(name)
                .setType(SkillType.ACTIVE_HEAL)
                .setCategory(SkillCategory.HEAL)
                .setCooldown(cd)
                                .setNeiliCost(toRageCost(cost))
                .setHealRatio(ratio)
                .setHealFlat(flat);
    }

        private Skill poison(String name, int cd, int cost, int duration, double ratio, int flat) {
                return new Skill()
                                .setId(name)
                                .setName(name)
                                .setType(SkillType.ACTIVE_POISON)
                                .setCategory(SkillCategory.DAMAGE)
                                .setCooldown(cd)
                                .setNeiliCost(toRageCost(cost))
                                .setDuration(duration)
                                .setPoisonRatio(ratio)
                                .setPoisonFlat(flat);
        }

        private int toRageCost(int legacyCost) {
                if (legacyCost >= 23) return 200;
                if (legacyCost >= 20) return 180;
                if (legacyCost >= 18) return 150;
                return 100;
        }

        private double clamp(double v, double min, double max) {
                return Math.max(min, Math.min(max, v));
        }

    private Skill passive(String name, int duration, Map<String, Double> buffs) {
        return new Skill()
                .setId(name)
                .setName(name)
                .setType(SkillType.PASSIVE)
                .setCategory(SkillCategory.DEFENSE)
                .setDuration(duration)
                .setBuffPercent(buffs);
    }

        @SafeVarargs
        private final <T> List<T> list(T... items) {
                return Arrays.asList(items);
        }

        private Map<String, Double> map(Object... kv) {
                Map<String, Double> m = new HashMap<>();
                for (int i = 0; i + 1 < kv.length; i += 2) {
                        m.put(String.valueOf(kv[i]), ((Number) kv[i + 1]).doubleValue());
                }
                return m;
        }
}

package com.knownedge.heropk.controller;

import com.knownedge.heropk.model.BattleRequest;
import com.knownedge.heropk.model.BattleResult;
import com.knownedge.heropk.model.Hero;
import com.knownedge.heropk.service.BattleService;
import com.knownedge.heropk.service.HeroDataService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class BattleController {

    private final HeroDataService heroDataService;
    private final BattleService battleService;

    public BattleController(HeroDataService heroDataService, BattleService battleService) {
        this.heroDataService = heroDataService;
        this.battleService = battleService;
    }

    @GetMapping("/heroes")
    public List<Hero> heroes() {
        return heroDataService.allHeroes();
    }

    @PostMapping("/battle/simulate")
    public BattleResult simulate(@RequestBody BattleRequest request) {
        return battleService.simulate(request);
    }

    @GetMapping("/meta")
    public Map<String, Object> meta() {
        Map<String, Object> root = map(
            "skillTriggerRate", 0.25,
            "normalAttackRate", 0.75,
            "hpFormula", "maxHp = tili * 10",
            "rageRule", "普通攻击按伤害回怒；怒气到100后按概率尝试释放可用武功；怒气上限300",
            "comboRule", "连击按角色连击率触发，追加当前命中伤害的50%；重击按重击率触发，使对手眩晕1回合",
            "poisonRule", "中毒武功可施加持续中毒，中毒目标在每次自己回合开始前掉血",
            "nearDeathRule", "部分角色在生命低于20%时触发濒死状态，持续2回合；基础暴击率/基础格挡率提升50%（武功buff单独叠加）",
            "weatherRule", "开战前随机抽取全球城市并查询当天天气：雨天双方能力-20%；晴天温湿适宜双方+20%；晴天高温双方-30%；阴天按体感双方±10%",
            "competitiveBalanceRule", "稳定层伤害/概率上限 + 条件爆发窗口 + 劣势机会修正（配置化）",
            "rageCap", 300,
            "skillReleaseRage", 100,
            "critRule", "暴击伤害按暴伤系数直接乘算（例如 125% => 1.25 倍，不再额外 +1）",
            "singleHitCap", map("normal", 0.14, "skill", 0.24),
            "damageRule", "采用攻防曲线减伤（Defense/(Defense+260)）+ 收敛随机波动 + 暴击/格挡软上限"
        );

        Map<String, Object> hpRules = map(
            "highHpAbove", 500,
            "midHpAbove", 300,
            "high", map("DAMAGE", 0.60, "DEFENSE", 0.25, "HEAL", 0.15),
            "mid", map("DAMAGE", 0.30, "DEFENSE", 0.50, "HEAL", 0.20),
            "low", map("DAMAGE", 0.15, "DEFENSE", 0.25, "HEAL", 0.60)
        );
        root.put("hpCategoryRules", hpRules);
        return root;
    }

        private Map<String, Object> map(Object... kv) {
        Map<String, Object> m = new HashMap<>();
        for (int i = 0; i + 1 < kv.length; i += 2) {
            m.put(String.valueOf(kv[i]), kv[i + 1]);
        }
        return m;
        }
}

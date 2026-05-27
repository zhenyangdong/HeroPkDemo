package com.knownedge.heropk.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

import java.io.IOException;

@Service
public class BalanceRulesService {

    private final BalanceRules rules;

    public BalanceRulesService(ObjectMapper objectMapper) {
        this.rules = load(objectMapper);
        validate(this.rules);
    }

    public BalanceRules getRules() {
        return rules;
    }

    private BalanceRules load(ObjectMapper objectMapper) {
        try {
            ClassPathResource resource = new ClassPathResource("config/balance-rules.json");
            return objectMapper.readValue(resource.getInputStream(), BalanceRules.class);
        } catch (IOException e) {
            throw new IllegalStateException("加载平衡规则失败: config/balance-rules.json", e);
        }
    }

    private void validate(BalanceRules v) {
        if (v == null || v.stable == null || v.burst == null || v.underdog == null) {
            throw new IllegalStateException("balance-rules.json 结构不完整");
        }
        if (v.stable.normalHitCap <= 0 || v.stable.skillHitCap <= 0) {
            throw new IllegalStateException("稳定层伤害上限配置非法");
        }
        if (v.burst.durationRounds <= 0) {
            throw new IllegalStateException("爆发窗口持续回合需大于0");
        }
        if (v.burst.killShotMaxChance < 0 || v.burst.killShotMaxChance > 0.03) {
            throw new IllegalStateException("killShotMaxChance 不可超过 0.03 且不可小于 0");
        }
        if (v.underdog.rageGainMultiplier < 1.0) {
            throw new IllegalStateException("劣势回怒修正倍率不可小于 1.0");
        }
    }

    public static class BalanceRules {
        public Stable stable;
        public Burst burst;
        public Underdog underdog;
    }

    public static class Stable {
        public double normalHitCap;
        public double skillHitCap;
        public double critChanceCap;
        public double comboChanceCap;
        public double heavyChanceCap;
    }

    public static class Burst {
        public double hpThreshold;
        public int rageThreshold;
        public int rageThresholdForKillShot;
        public int durationRounds;
        public double normalHitCap;
        public double skillHitCap;
        public double critChanceCap;
        public double comboChanceCap;
        public double heavyChanceCap;
        public double killShotMaxChance;
    }

    public static class Underdog {
        public double powerGapThreshold;
        public double hitBonus;
        public double rageGainMultiplier;
    }
}

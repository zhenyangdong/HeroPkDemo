package com.knownedge.heropk.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;

public class BalanceRulesServiceTest {

    @Test
    void shouldLoadRulesWithExpectedCaps() {
        BalanceRulesService service = new BalanceRulesService(new ObjectMapper());
        BalanceRulesService.BalanceRules rules = service.getRules();

        Assertions.assertEquals(0.16, rules.stable.normalHitCap, 0.0001);
        Assertions.assertEquals(0.24, rules.stable.skillHitCap, 0.0001);
        Assertions.assertEquals(0.03, rules.burst.killShotMaxChance, 0.0001);
        Assertions.assertTrue(rules.underdog.powerGapThreshold >= 0.15);
        Assertions.assertTrue(rules.underdog.rageGainMultiplier >= 1.0);
    }
}

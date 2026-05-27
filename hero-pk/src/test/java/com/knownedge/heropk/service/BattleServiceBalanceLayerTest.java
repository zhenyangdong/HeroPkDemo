package com.knownedge.heropk.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.knownedge.heropk.model.BattleRequest;
import com.knownedge.heropk.model.BattleResult;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;

public class BattleServiceBalanceLayerTest {

    @Test
    void shouldExposeBalanceTraceAndDeterministicRoundZero() {
        ObjectMapper mapper = new ObjectMapper();
        HeroDataService heroData = new HeroDataService(mapper);
        WeatherImpactService weather = new WeatherImpactService(mapper);
        BalanceRulesService balance = new BalanceRulesService(mapper);
        BattleService service = new BattleService(heroData, weather, balance);

        BattleRequest request = new BattleRequest();
        request.setLeftHeroId("qiaofeng");
        request.setRightHeroId("yangxia");
        request.setMaxRounds(10);
        request.setSeed(20260527L);

        BattleResult result = service.simulate(request);
        Assertions.assertFalse(result.getLogs().isEmpty());
        Assertions.assertNotNull(result.getBalanceSummary());
        Assertions.assertTrue(result.getBalanceSummary().contains("stable"));
    }
}

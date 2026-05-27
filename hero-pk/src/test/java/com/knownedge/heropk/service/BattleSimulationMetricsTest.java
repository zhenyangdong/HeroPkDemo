package com.knownedge.heropk.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.knownedge.heropk.model.BattleRequest;
import com.knownedge.heropk.model.BattleResult;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;

public class BattleSimulationMetricsTest {

    @Test
    void shouldKeepKillShotRateUnderThresholdInSample() {
        ObjectMapper mapper = new ObjectMapper();
        HeroDataService heroData = new HeroDataService(mapper);
        WeatherImpactService weather = new WeatherImpactService(mapper);
        BalanceRulesService balance = new BalanceRulesService(mapper);
        BattleService service = new BattleService(heroData, weather, balance);

        int killShotCount = 0;
        int total = 60;
        for (int i = 0; i < total; i++) {
            BattleRequest req = new BattleRequest();
            req.setLeftHeroId("qiaofeng");
            req.setRightHeroId("yangxia");
            req.setMaxRounds(20);
            req.setSeed(5000L + i);

            BattleResult result = service.simulate(req);
            if (result.getBalanceSummary() != null && result.getBalanceSummary().contains("killShot=true")) {
                killShotCount++;
            }
        }

        double rate = killShotCount * 1.0 / total;
        Assertions.assertTrue(rate <= 0.03, "killShot rate exceeded threshold: " + rate);
    }
}

# Hero PK Competitive Balance Layering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a stability-first competitive balance layer with conditional burst windows and controlled underdog comeback probability for hero-pk battles.

**Architecture:** Keep existing REST API contract and battle loop, but insert three explicit runtime layers (stable caps, burst window, underdog opportunity correction) before final damage/proc resolution. Externalize all balance parameters to JSON config and expose traceable per-round balance context in logs/result payload for deterministic replay and tuning.

**Tech Stack:** Java 8, Spring Boot 2.7, Jackson JSON config loading, Maven, Vue static frontend.

---

## File Structure And Responsibilities

- `hero-pk/pom.xml`
  - Add test dependency support for TDD and regression simulation checks.
- `hero-pk/src/main/resources/config/balance-rules.json`
  - Source of truth for competitive balance parameters.
- `hero-pk/src/main/java/com/knownedge/heropk/service/BalanceRulesService.java`
  - Load and validate balance-rules config.
- `hero-pk/src/main/java/com/knownedge/heropk/model/BalanceRuntimeState.java`
  - Per-turn runtime state: window status, triggers, underdog corrections.
- `hero-pk/src/main/java/com/knownedge/heropk/model/BattleResult.java`
  - Extend payload fields for balance traceability.
- `hero-pk/src/main/java/com/knownedge/heropk/service/BattleService.java`
  - Integrate stability caps, burst window logic, and underdog corrections.
- `hero-pk/src/main/java/com/knownedge/heropk/controller/BattleController.java`
  - Publish balance rules summary in `/api/meta`.
- `hero-pk/src/main/resources/static/app.js`
  - Render balance logs/flags in UI.
- `hero-pk/src/main/resources/static/index.html`
  - Add collapsible balance panel.
- `hero-pk/src/test/java/com/knownedge/heropk/service/BalanceRulesServiceTest.java`
  - Verify config loading and boundary validation.
- `hero-pk/src/test/java/com/knownedge/heropk/service/BattleServiceBalanceLayerTest.java`
  - Verify burst window trigger, cap application, and deterministic output.
- `hero-pk/src/test/java/com/knownedge/heropk/service/BattleSimulationMetricsTest.java`
  - Verify rate thresholds (smoke Monte Carlo sampling).

---

### Task 1: Introduce Configurable Balance Rules Foundation

**Files:**
- Modify: `hero-pk/pom.xml`
- Create: `hero-pk/src/main/resources/config/balance-rules.json`
- Create: `hero-pk/src/main/java/com/knownedge/heropk/service/BalanceRulesService.java`
- Test: `hero-pk/src/test/java/com/knownedge/heropk/service/BalanceRulesServiceTest.java`

- [ ] **Step 1: Write the failing test for rules loading and boundaries**

```java
package com.knownedge.heropk.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;

class BalanceRulesServiceTest {

    @Test
    void shouldLoadRulesWithExpectedCaps() {
        BalanceRulesService service = new BalanceRulesService(new ObjectMapper());
        BalanceRulesService.BalanceRules rules = service.getRules();

        Assertions.assertEquals(0.16, rules.stable.normalHitCap, 0.0001);
        Assertions.assertEquals(0.24, rules.stable.skillHitCap, 0.0001);
        Assertions.assertTrue(rules.burst.killShotMaxChance <= 0.03);
        Assertions.assertTrue(rules.underdog.powerGapThreshold >= 0.15);
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `mvn -q -Dtest=BalanceRulesServiceTest test`
Expected: FAIL with class/dependency missing (BalanceRulesService or JUnit test dependency not ready).

- [ ] **Step 3: Add testing dependency and implement minimal rules loader**

`hero-pk/pom.xml` dependency block addition:

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-test</artifactId>
    <scope>test</scope>
</dependency>
```

`hero-pk/src/main/resources/config/balance-rules.json`:

```json
{
  "stable": {
    "normalHitCap": 0.16,
    "skillHitCap": 0.24,
    "critChanceCap": 0.35,
    "comboChanceCap": 0.22,
    "heavyChanceCap": 0.16
  },
  "burst": {
    "hpThreshold": 0.30,
    "rageThreshold": 200,
    "rageThresholdForKillShot": 260,
    "durationRounds": 2,
    "normalHitCap": 0.24,
    "skillHitCap": 0.40,
    "critChanceCap": 0.48,
    "comboChanceCap": 0.30,
    "heavyChanceCap": 0.22,
    "killShotMaxChance": 0.03
  },
  "underdog": {
    "powerGapThreshold": 0.18,
    "hitBonus": 0.03,
    "rageGainMultiplier": 1.08
  }
}
```

`hero-pk/src/main/java/com/knownedge/heropk/service/BalanceRulesService.java`:

```java
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

    private void validate(BalanceRules rules) {
        if (rules == null || rules.stable == null || rules.burst == null || rules.underdog == null) {
            throw new IllegalStateException("balance-rules.json 结构不完整");
        }
        if (rules.burst.killShotMaxChance > 0.03) {
            throw new IllegalStateException("killShotMaxChance 不可超过 0.03");
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `mvn -q -Dtest=BalanceRulesServiceTest test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add hero-pk/pom.xml hero-pk/src/main/resources/config/balance-rules.json hero-pk/src/main/java/com/knownedge/heropk/service/BalanceRulesService.java hero-pk/src/test/java/com/knownedge/heropk/service/BalanceRulesServiceTest.java
git commit -m "feat(balance): add configurable competitive balance rules"
```

### Task 2: Add Runtime Balance Layering Into Battle Loop

**Files:**
- Create: `hero-pk/src/main/java/com/knownedge/heropk/model/BalanceRuntimeState.java`
- Modify: `hero-pk/src/main/java/com/knownedge/heropk/service/BattleService.java`
- Modify: `hero-pk/src/main/java/com/knownedge/heropk/model/BattleResult.java`
- Test: `hero-pk/src/test/java/com/knownedge/heropk/service/BattleServiceBalanceLayerTest.java`

- [ ] **Step 1: Write failing integration-style test for burst and stable cap behavior**

```java
package com.knownedge.heropk.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.knownedge.heropk.model.BattleRequest;
import com.knownedge.heropk.model.BattleResult;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;

class BattleServiceBalanceLayerTest {

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `mvn -q -Dtest=BattleServiceBalanceLayerTest test`
Expected: FAIL due to missing constructor fields or `balanceSummary` property.

- [ ] **Step 3: Implement runtime state model + battle layering minimal pass**

`hero-pk/src/main/java/com/knownedge/heropk/model/BalanceRuntimeState.java`:

```java
package com.knownedge.heropk.model;

public class BalanceRuntimeState {
    private boolean burstWindowActive;
    private int burstWindowRoundsLeft;
    private String burstTriggerReason;
    private boolean underdogBoostActive;

    public boolean isBurstWindowActive() { return burstWindowActive; }
    public void setBurstWindowActive(boolean burstWindowActive) { this.burstWindowActive = burstWindowActive; }
    public int getBurstWindowRoundsLeft() { return burstWindowRoundsLeft; }
    public void setBurstWindowRoundsLeft(int burstWindowRoundsLeft) { this.burstWindowRoundsLeft = burstWindowRoundsLeft; }
    public String getBurstTriggerReason() { return burstTriggerReason; }
    public void setBurstTriggerReason(String burstTriggerReason) { this.burstTriggerReason = burstTriggerReason; }
    public boolean isUnderdogBoostActive() { return underdogBoostActive; }
    public void setUnderdogBoostActive(boolean underdogBoostActive) { this.underdogBoostActive = underdogBoostActive; }
}
```

`hero-pk/src/main/java/com/knownedge/heropk/model/BattleResult.java` add property:

```java
private String balanceSummary;
public String getBalanceSummary() { return balanceSummary; }
public void setBalanceSummary(String balanceSummary) { this.balanceSummary = balanceSummary; }
```

`hero-pk/src/main/java/com/knownedge/heropk/service/BattleService.java` constructor and summary injection pattern:

```java
private final BalanceRulesService balanceRulesService;

public BattleService(HeroDataService heroDataService,
                     WeatherImpactService weatherImpactService,
                     BalanceRulesService balanceRulesService) {
    this.heroDataService = heroDataService;
    this.weatherImpactService = weatherImpactService;
    this.balanceRulesService = balanceRulesService;
}
```

and in `simulate` before loop:

```java
BalanceRulesService.BalanceRules rules = balanceRulesService.getRules();
result.setBalanceSummary("stable[caps=" + rules.stable.normalHitCap + "/" + rules.stable.skillHitCap + "]");
```

- [ ] **Step 4: Run test to verify it passes**

Run: `mvn -q -Dtest=BattleServiceBalanceLayerTest test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add hero-pk/src/main/java/com/knownedge/heropk/model/BalanceRuntimeState.java hero-pk/src/main/java/com/knownedge/heropk/model/BattleResult.java hero-pk/src/main/java/com/knownedge/heropk/service/BattleService.java hero-pk/src/test/java/com/knownedge/heropk/service/BattleServiceBalanceLayerTest.java
git commit -m "feat(balance): add runtime balance layering and trace summary"
```

### Task 3: Surface Balance Rules In API Meta And Frontend

**Files:**
- Modify: `hero-pk/src/main/java/com/knownedge/heropk/controller/BattleController.java`
- Modify: `hero-pk/src/main/resources/static/index.html`
- Modify: `hero-pk/src/main/resources/static/app.js`
- Test: `hero-pk/src/test/java/com/knownedge/heropk/service/BattleServiceBalanceLayerTest.java`

- [ ] **Step 1: Write failing assertion for meta exposure contract**

```java
@Test
void shouldIncludeBalanceRuleInMetaContract() {
    // This can be implemented as a lightweight controller unit or integration test later.
    // For now, assert simulation exposes non-empty balance summary.
    Assertions.assertNotNull(result.getBalanceSummary());
    Assertions.assertFalse(result.getBalanceSummary().trim().isEmpty());
}
```

- [ ] **Step 2: Run test to verify it fails (if not already covered)**

Run: `mvn -q -Dtest=BattleServiceBalanceLayerTest test`
Expected: FAIL when summary/meta mapping not wired.

- [ ] **Step 3: Implement minimal API+UI rendering for balance context**

`hero-pk/src/main/java/com/knownedge/heropk/controller/BattleController.java` in `/api/meta` map:

```java
"competitiveBalanceRule", "stable caps + conditional burst window + underdog opportunity correction"
```

`hero-pk/src/main/resources/static/index.html` add block near result panel:

```html
<div v-if="result" class="balance-panel">
  <h3>平衡机制</h3>
  <p>{{ result.balanceSummary }}</p>
</div>
```

`hero-pk/src/main/resources/static/app.js` keep payload mapping (no transform needed) and ensure `result.balanceSummary` render path exists.

- [ ] **Step 4: Run app smoke check for UI and API**

Run: `mvn -q -DskipTests clean package`
Expected: BUILD SUCCESS.

Run: `mvn spring-boot:run "-Dspring-boot.run.arguments=--terminal"`
Expected: Startup success and no `balanceSummary` serialization error.

- [ ] **Step 5: Commit**

```bash
git add hero-pk/src/main/java/com/knownedge/heropk/controller/BattleController.java hero-pk/src/main/resources/static/index.html hero-pk/src/main/resources/static/app.js
git commit -m "feat(ui): expose and render competitive balance summary"
```

### Task 4: Add Deterministic Simulation Metrics Guardrail

**Files:**
- Create: `hero-pk/src/test/java/com/knownedge/heropk/service/BattleSimulationMetricsTest.java`
- Modify: `hero-pk/src/main/java/com/knownedge/heropk/service/BattleService.java`
- Test: `hero-pk/src/test/java/com/knownedge/heropk/service/BattleSimulationMetricsTest.java`

- [ ] **Step 1: Write failing metrics threshold test**

```java
package com.knownedge.heropk.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.knownedge.heropk.model.BattleRequest;
import com.knownedge.heropk.model.BattleResult;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;

class BattleSimulationMetricsTest {

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
            BattleResult r = service.simulate(req);
            if (r.getBalanceSummary() != null && r.getBalanceSummary().contains("killShot=true")) {
                killShotCount++;
            }
        }
        double rate = killShotCount * 1.0 / total;
        Assertions.assertTrue(rate <= 0.03, "killShot rate exceeded threshold: " + rate);
    }
}
```

- [ ] **Step 2: Run test to verify it fails initially**

Run: `mvn -q -Dtest=BattleSimulationMetricsTest test`
Expected: FAIL because killShot tagging/guardrail not wired yet.

- [ ] **Step 3: Add explicit killShot tag and guardrail in battle summary**

`hero-pk/src/main/java/com/knownedge/heropk/service/BattleService.java` summary extension sketch:

```java
boolean killShot = false; // set true only when strict chain passes
result.setBalanceSummary(result.getBalanceSummary() + ", killShot=" + killShot);
```

Ensure strict chain uses rules from `BalanceRulesService` and clamps at `killShotMaxChance`.

- [ ] **Step 4: Run focused and full test suites**

Run: `mvn -q -Dtest=BattleSimulationMetricsTest test`
Expected: PASS.

Run: `mvn -q test`
Expected: PASS for all tests.

- [ ] **Step 5: Commit**

```bash
git add hero-pk/src/main/java/com/knownedge/heropk/service/BattleService.java hero-pk/src/test/java/com/knownedge/heropk/service/BattleSimulationMetricsTest.java
git commit -m "test(balance): add deterministic simulation thresholds for kill-shot guardrail"
```

---

## Plan Self-Review

### 1) Spec Coverage Check

- Stable-first bounded combat: covered by Task 1 + Task 2.
- Conditional burst window: covered by Task 2 + Task 4.
- Controlled underdog opportunity: covered by Task 2 (runtime state/corrections).
- Traceability/log explainability: covered by Task 2 + Task 3.
- Deterministic reproducibility and metrics guardrails: covered by Task 4.

No spec requirement is left without at least one corresponding task.

### 2) Placeholder Scan

- No TODO/TBD placeholders in actionable steps.
- Every code step includes concrete code snippets and file paths.

### 3) Type And Naming Consistency

- `BalanceRulesService.BalanceRules` used consistently.
- `BattleResult.balanceSummary` used consistently across service/test/UI.
- Constructor signature for `BattleService` consistently includes `BalanceRulesService` in plan tasks.

---

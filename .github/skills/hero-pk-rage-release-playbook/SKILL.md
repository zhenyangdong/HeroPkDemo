---
name: hero-pk-rage-release-playbook
description: "Implement and tune hero-pk rage mechanics. Use for normal-attack rage gain, rage-gated skill release, skill rage cost tiers, and deterministic validation."
argument-hint: "目标，例如：怒气上限300，100怒气可释放，重型技能消耗150-200"
user-invocable: true
---

# Hero PK Rage Release Playbook

## When To Use
- You want to add or tune rage gain in hero-pk.
- You want skill release to depend on rage thresholds.
- You need to configure skill rage costs (100/150/180/200) and validate behavior.

## Procedure
1. Locate battle flow in hero-pk service and identify action resolution points.
2. Add rage state fields to fighter runtime and round snapshot output.
3. Implement rage gain from normal attacks proportional to damage.
4. Add optional rage gain on defender when taking crit damage.
5. Gate skill release by rage threshold and usable skill pool.
6. Enforce rage consumption per skill and cap rage at configured max.
7. Update metadata and UI text to explain rage rules.
8. Build and run deterministic simulations to verify logs and states.

## Verification Checklist
- Build success.
- Rage increases on normal attacks and respects cap.
- Skills are only released when rage threshold is met.
- Skill release spends rage and remaining rage is visible in logs.
- At least one deterministic sample shows: gain rage -> reach threshold -> release skill.

## Suggested Outputs
- Modified files list.
- Rage formulas and thresholds used.
- 1-3 sample logs proving rage gain/spend and skill trigger.
- Follow-up tuning suggestions (gain ratio, release probability, cost tiers).

---
name: hero-pk-battle-playbook
description: "Tune and verify hero-pk damage formulas. Use for damage calculation adjustments, hit/crit/block balance, and simulation-based validation in hero-pk."
argument-hint: "目标，例如：将普通攻击稳定在90-140，技能在160-240"
user-invocable: true
---

# Hero PK Battle Playbook

## When To Use
- You want to rebalance damage in hero-pk.
- You need to explain formula changes with concrete numbers.
- You want deterministic simulation evidence before finalizing tweaks.

## Procedure
1. Identify formula entry points in the battle service.
2. Adjust only the minimum required coefficients/limits.
3. Build with Maven to ensure compilation passes.
4. Run deterministic simulations with several seeds.
5. Summarize distribution (min/avg/max) for normal and skill damage.
6. If requested, add a user-facing formula explanation and an example in UI.

## Verification Checklist
- Build success.
- No extreme one-hit spikes outside configured cap.
- Miss/crit/block logs remain interpretable.
- At least one sample duel report provided.

## Suggested Outputs
- Modified files list.
- Formula diff (old vs new).
- Empirical range table from simulation runs.
- Follow-up calibration suggestions.

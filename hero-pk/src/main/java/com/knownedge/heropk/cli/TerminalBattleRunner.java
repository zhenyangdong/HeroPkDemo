package com.knownedge.heropk.cli;

import com.knownedge.heropk.model.BattleRequest;
import com.knownedge.heropk.model.BattleResult;
import com.knownedge.heropk.model.Hero;
import com.knownedge.heropk.model.PrimaryStats;
import com.knownedge.heropk.model.SecondaryStats;
import com.knownedge.heropk.service.BattleService;
import com.knownedge.heropk.service.HeroDataService;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Scanner;

@Component
public class TerminalBattleRunner implements ApplicationRunner {

    private final HeroDataService heroDataService;
    private final BattleService battleService;
    private final ConfigurableApplicationContext context;

    public TerminalBattleRunner(HeroDataService heroDataService,
                                BattleService battleService,
                                ConfigurableApplicationContext context) {
        this.heroDataService = heroDataService;
        this.battleService = battleService;
        this.context = context;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (!args.containsOption("terminal")) {
            return;
        }

        Scanner scanner = new Scanner(System.in);
        List<Hero> heroes = heroDataService.allHeroes();

        println("====================================");
        println("  金庸英雄 PK 终端模式");
        println("  参数模式: --terminal");
        println("====================================");

        boolean running = true;
        while (running) {
            printHeroList(heroes);

            int leftIndex = askHeroIndex(scanner, heroes, "请选择左侧英雄编号");
            int rightIndex = askHeroIndex(scanner, heroes, "请选择右侧英雄编号（可与左侧相同）");
            int maxRounds = askInt(scanner, "最大回合数（默认30）", 30, 1, 200);
            Long seed = askOptionalLong(scanner, "随机种子（回车留空=随机）");

            Hero left = heroes.get(leftIndex - 1);
            Hero right = heroes.get(rightIndex - 1);

            println("\n[对战双方属性]");
            printHeroDetail("左侧", left);
            printHeroDetail("右侧", right);

            BattleRequest request = new BattleRequest();
            request.setLeftHeroId(left.getId());
            request.setRightHeroId(right.getId());
            request.setMaxRounds(maxRounds);
            request.setSeed(seed);

            BattleResult result = battleService.simulate(request);
            printBattleLogs(result);

            String again = askText(scanner, "\n继续下一场？(y/n，默认n)");
            running = "y".equalsIgnoreCase(again.trim());
            println("");
        }

        println("终端模式结束，应用即将退出。");
        int code = org.springframework.boot.SpringApplication.exit(context, () -> 0);
        System.exit(code);
    }

    private void printHeroList(List<Hero> heroes) {
        println("\n[英雄列表]");
        for (int i = 0; i < heroes.size(); i++) {
            Hero h = heroes.get(i);
            println(String.format("%2d) %s (%s)%s", i + 1, h.getName(), h.getTitle(),
                    h.isNearDeathEnabled() ? " [含濒死]" : ""));
        }
    }

    private void printHeroDetail(String side, Hero hero) {
        PrimaryStats p = hero.getPrimary();
        SecondaryStats s = hero.getSecondary();
        println(String.format("- %s: %s (%s)", side, hero.getName(), hero.getTitle()));
        println(String.format("  一级: 体力 %d / 武力 %d / 防御 %d / 内力 %d / 最大生命 %d",
                p.getTili(), p.getWuli(), p.getFangyu(), p.getNeili(), p.getTili() * 10));
        println(String.format("  二级: 暴击 %s / 暴伤 %s / 命中 %s / 闪避 %s / 格挡 %s / 格挡伤害 %s",
                pct(s.getCritRate()), pct(s.getCritDamageRate()), pct(s.getHitRate()),
                pct(s.getDodgeRate()), pct(s.getBlockRate()), pct(s.getBlockDamage())));
        println(String.format("  特性: 连击 %s / 重击 %s / 濒死 %s",
                pct(s.getComboRate()), pct(s.getHeavyRate()), hero.isNearDeathEnabled() ? "开启" : "关闭"));
    }

    private void printBattleLogs(BattleResult result) {
        println("\n[战斗过程]");
        for (BattleResult.RoundLog log : result.getLogs()) {
            String line = String.format("R%02d %-4s %-8s | %s",
                    log.getRound(), log.getActor(), log.getAction(), log.getDetail());
            println(line);
            println(String.format("     HP: %s %d | %s %d",
                    result.getLeftHero(), log.getLeftHp(), result.getRightHero(), log.getRightHp()));

            if (log.getLeftState() != null && log.getRightState() != null) {
                println(String.format("     怒气: %s %d/%d | %s %d/%d",
                        result.getLeftHero(), log.getLeftState().getRage(), log.getLeftState().getMaxRage(),
                        result.getRightHero(), log.getRightState().getRage(), log.getRightState().getMaxRage()));
            }
        }

        println("\n[战斗结果]");
        println(String.format("胜者: %s", result.getWinner()));
        println(String.format("回合数: %d", result.getRounds()));
    }

    private int askHeroIndex(Scanner scanner, List<Hero> heroes, String prompt) {
        return askInt(scanner, prompt, 1, 1, heroes.size());
    }

    private int askInt(Scanner scanner, String prompt, int defaultValue, int min, int max) {
        while (true) {
            String raw = askText(scanner, String.format("%s [%d-%d，默认%d]", prompt, min, max, defaultValue));
            String text = raw.trim();
            if (text.isEmpty()) {
                return defaultValue;
            }
            try {
                int value = Integer.parseInt(text);
                if (value >= min && value <= max) {
                    return value;
                }
            } catch (NumberFormatException ignore) {
            }
            println("输入无效，请重新输入。");
        }
    }

    private Long askOptionalLong(Scanner scanner, String prompt) {
        while (true) {
            String text = askText(scanner, prompt).trim();
            if (text.isEmpty()) {
                return null;
            }
            try {
                return Long.parseLong(text);
            } catch (NumberFormatException ignore) {
                println("请输入整数种子，或直接回车使用随机种子。");
            }
        }
    }

    private String askText(Scanner scanner, String prompt) {
        System.out.print(prompt + ": ");
        return scanner.hasNextLine() ? scanner.nextLine() : "";
    }

    private String pct(double v) {
        return String.format("%.0f%%", v * 100.0);
    }

    private void println(String text) {
        System.out.println(text);
    }
}

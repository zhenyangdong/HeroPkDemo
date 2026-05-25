package com.knownedge.heropk;

import org.springframework.boot.WebApplicationType;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

import java.util.Arrays;

@SpringBootApplication
public class HeroPkApplication {
    public static void main(String[] args) {
        SpringApplication app = new SpringApplication(HeroPkApplication.class);
        if (Arrays.asList(args).contains("--terminal")) {
            app.setWebApplicationType(WebApplicationType.NONE);
        }
        app.run(args);
    }
}

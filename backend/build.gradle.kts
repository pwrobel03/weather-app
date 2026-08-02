plugins {
    kotlin("jvm") version "2.4.10"
    kotlin("plugin.spring") version "2.4.10"
    id("org.springframework.boot") version "4.1.0"
    id("io.spring.dependency-management") version "1.1.7"
}

group = "com.weatherapp"
version = "0.1.0"

repositories {
    mavenCentral()
}

kotlin {
    jvmToolchain(21)
    compilerOptions {
        freeCompilerArgs.add("-Xjsr305=strict")
    }
}

dependencies {
    implementation("org.springframework.boot:spring-boot-starter-web")
    implementation("org.springframework.boot:spring-boot-starter-websocket")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core")
    implementation("org.springframework.boot:spring-boot-starter-flyway")
    implementation("org.springframework.boot:spring-boot-starter-restclient")
    implementation("org.springframework.boot:spring-boot-starter-cache")
    implementation("com.github.ben-manes.caffeine:caffeine")
    implementation("org.springdoc:springdoc-openapi-starter-webmvc-ui:2.8.5")
    implementation("com.fasterxml.jackson.module:jackson-module-kotlin")
    implementation("org.jetbrains.kotlin:kotlin-reflect")

    // Signs the service-account JWT that FCM HTTP v1 exchanges for an access
    // token. Google's own library rather than hand-rolled JWT signing: the
    // token has to be refreshed before it expires, and getting that wrong is a
    // push channel that works for an hour after every deploy.
    implementation("com.google.auth:google-auth-library-oauth2-http:1.30.0")
    implementation("org.springframework.boot:spring-boot-starter-security")
    implementation("org.springframework.boot:spring-boot-starter-validation")
    implementation("io.jsonwebtoken:jjwt-api:0.12.6")
    runtimeOnly("io.jsonwebtoken:jjwt-impl:0.12.6")
    runtimeOnly("io.jsonwebtoken:jjwt-jackson:0.12.6")

    implementation("org.flywaydb:flyway-database-postgresql")
    runtimeOnly("org.postgresql:postgresql")

    // Loads backend/.env for local dev only - real env vars always win,
    // and it's excluded from the packaged jar (developmentOnly).
    developmentOnly(platform("me.paulschwarz:spring-dotenv-bom:5.1.0"))
    developmentOnly("me.paulschwarz:springboot4-dotenv")

    testImplementation(platform("org.testcontainers:testcontainers-bom:2.0.5"))
    testImplementation("org.springframework.boot:spring-boot-starter-test")
    testImplementation("org.testcontainers:testcontainers-junit-jupiter")
    testImplementation("org.mockito.kotlin:mockito-kotlin:5.4.0")
    testImplementation(kotlin("test"))
}

tasks.test {
    useJUnitPlatform()
    // OpenApiGeneratorTest writes build/openapi/openapi.json as a side effect.
    // Declaring it as an output keeps Gradle's up-to-date check honest: if the
    // file is missing, `test` reruns even when the sources haven't changed.
    outputs.file(layout.buildDirectory.file("openapi/openapi.json"))
}

tasks.register("generateOpenApiDocs") {
    group = "documentation"
    description = "Generates OpenAPI specification as a build artifact at build/openapi/openapi.json"
    dependsOn(tasks.test)
    doLast {
        val specFile = file("build/openapi/openapi.json")
        if (!specFile.exists()) {
            throw GradleException(
                "OpenAPI specification was not found at ${specFile.absolutePath}. Ensure OpenApiGeneratorTest passes.",
            )
        }
        logger.lifecycle("OpenAPI specification available at: ${specFile.absolutePath}")
    }
}

tasks.register("generateOpenApi") {
    dependsOn("generateOpenApiDocs")
}

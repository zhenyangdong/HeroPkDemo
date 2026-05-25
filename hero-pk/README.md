# Hero PK (Vue + Java)

## 启动方式

1. 进入目录

```bash
cd hero-pk
```

2. 启动后端（Spring Boot，同时托管 Vue 静态页面）

```bash
mvn spring-boot:run
```

3. 浏览器打开

http://localhost:8081

## 已实现

- 10 个金庸角色（含一级/二级属性）
- 回合制 PK 模拟
- 15% 主动技能触发，85% 普通攻击
- 体力分段技能类别偏好（高血伤害，中血防御，低血补血）
- 技能冷却、伤害判定（命中/暴击/格挡）
- Vue 页面文本主导展示 + 血条/属性条图形化

## API

- GET /api/heroes
- GET /api/meta
- POST /api/battle/simulate

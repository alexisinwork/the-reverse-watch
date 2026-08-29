# Схема брендового файла Watch KB

**Версия:** 1.0 · **срез:** 28 августа 2026.

Каждый файл имеет ровно семь разделов: (1) юридическая анатомия; (2) психологический код; (3) каталог; (4) рыночный слой; (5) Q1–Q9; (6) JSON-теги; (7) источники. Рекомендуемая нарезка: один H2-блок = один чанк; каталог делить по 8–12 строк с повтором заголовка и метаданных `brand`, `as_of`.

## Шаблон

```markdown
# {brand}
## 1. ЮРИДИЧЕСКАЯ И КОРПОРАТИВНАЯ АНАТОМИЯ
## 2. ПСИХОЛОГИЧЕСКИЙ КОД И СОЦИАЛЬНЫЙ СИГНАЛ
## 3. КАТАЛОГ РЕФЕРЕНСОВ
## 4. РЫНОЧНЫЙ СЛОЙ И ПРОФИЛЬ ПОКУПАТЕЛЯ
## 5. МАППИНГ НА ОПРОСНИК (Q1-Q9)
## 6. ВЕКТОРНЫЕ ТЕГИ
## 7. ИСТОЧНИКИ
```

## JSON Schema тегов

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "required": ["brand","ownership_type","lineage_continuity","movement_origin","price_tiers","target_wrist_circumference","aesthetic_dna","social_signals","maintenance_profile","market_momentum","hype_risk","liquidity","buyer_layers","archetypes","data_confidence"],
  "properties": {
    "brand": {"type":"string"},
    "ownership_type": {"type":"string"},
    "lineage_continuity": {"type":"string"},
    "movement_origin": {"type":"string"},
    "price_tiers": {"type":"array","items":{"enum":["under_300","300_500","500_1k","1k_2k","2k_5k","5k_10k","10k_15k","15k_plus"]}},
    "target_wrist_circumference": {"type":"array","items":{"type":"string"}},
    "aesthetic_dna": {"type":"array","items":{"enum":["structural_tool","mid_century","integrated_geometry","extravagant_creative","high_art"]}},
    "social_signals": {"type":"array","items":{"enum":["discreet_competence","quiet_continuity","unapologetic_success","anti_luxury"]}},
    "maintenance_profile": {"enum":["zero_maintenance","workhorse","in_house"]},
    "market_momentum": {"type":"array","items":{"enum":["evergreen","macro_trend","insider_hype","speculative_bubble","contrarian"]}},
    "hype_risk": {"enum":["low","medium","high"]},
    "liquidity": {"enum":["low","medium","high"]},
    "buyer_layers": {"type":"array","items":{"type":"integer","minimum":1,"maximum":5}},
    "archetypes": {"type":"array","items":{"type":"string"}},
    "data_confidence": {
      "type":"object",
      "required":["dimensions","market_data","service_data","notes"],
      "properties":{
        "dimensions":{"enum":["observed","estimated_class","missing"]},
        "market_data":{"enum":["observed","estimated_class","missing"]},
        "service_data":{"enum":["observed","estimated_class","missing"]},
        "notes":{"type":"string"}
      },
      "additionalProperties":false
    }
  },
  "additionalProperties": false
}
```

## Нормализация

- Числа хранятся в мм/часах/метрах; `≈` означает неофициальное измерение.
- Неизвестное значение — строка `данные отсутствуют`, не ноль.
- Цена всегда содержит валюту, дату среза и тир.
- Ряд каталога — семейство общей геометрии; варианты с иной геометрией получают отдельную строку.
- Рыночные проценты — диапазон сделки, не прогноз.

## Доступность производства (`production_status`)

`production_status` — производное поле кросс-брендового индекса, определяемое по тексту разделов 1 и 3 брендового файла. Допустимо ровно одно из пяти значений:

- `active` — марка ведёт текущее производство, и часы можно купить новыми.
- `vintage_only` — современного выпуска нет; доступен только вторичный/винтажный рынок.
- `nos_stock` — производство остановлено; продаются складские остатки, NOS или пересборки.
- `waitlist` — производство продолжается, но практический доступ возможен только через лист ожидания или аукцион.
- `revived` — товарный знак куплен, и выпуск после производственного разрыва возобновлён недавно.

Если статус нельзя определить однозначно, используется `active`, когда файл указывает действующую розницу, и `vintage_only`, когда розница отсутствует и все цены относятся к вторичному рынку.

Правило для рекомендационного движка: для запроса «купить новыми» записи со статусами `vintage_only` и `nos_stock` отфильтровываются; записи со статусом `waitlist` допускаются только с явным предупреждением о сроке ожидания.

## Политика достоверности данных

В тексте брендовых файлов применяются три маркера:

- `[набл.]` — наблюдаемое значение с источником: официальная спецификация, измерительный обзор, наблюдаемый листинг или иное прямо зафиксированное значение.
- `[оц.класс]` — оценка по классу бренда; база оценки обязательно указывается в скобках маркера, например `[оц.класс: геометрия корпуса 40 мм]`.
- `[нет данных]` — даже классовая оценка невозможна; рядом обязательно указывается причина отсутствия данных.

В JSON-блоке раздела 6 каждого брендового файла обязателен объект:

```json
"data_confidence": {
  "dimensions": "observed | estimated_class | missing",
  "market_data": "observed | estimated_class | missing",
  "service_data": "observed | estimated_class | missing",
  "notes": "краткое пояснение состава наблюдаемых, оценочных и отсутствующих данных"
}
```

Для `dimensions`, `market_data` и `service_data` допустимо ровно одно из значений: `observed`, `estimated_class`, `missing`.

Правило для рекомендационного движка: записи с уровнем `estimated_class` не отбрасываются при фильтрации, но получают понижающий вес в ранжировании и в пользовательской выдаче явно помечаются как оценочные.

# Диагностический опросник выбора часов

**Принцип:** hard filters исключают физически/операционно несовместимые варианты; soft vectors ранжируют оставшиеся. Размер корпуса сам по себе недостаточен: lug-to-lug определяет охват верхней поверхности запястья, а толщина и форма ушек меняют посадку ([lug²lug](https://www.lug2lug.org/guides/watch-size-guide)).

## Базовый Q1–Q9

### Q1. Бюджет — hard filter `price_tiers`
A under_300; B 300_500; C 500_1k; D 1k_2k; E 2k_5k; F 5k_10k; G 10k_15k; H 15k_plus. Уточнить: лимит до/после налога и допустим ли pre-owned.

### Q2. Обхват запястья — hard filter `target_wrist_circumference`
A <5.75″ / <146 мм; B 5.75–6.25″ / 146–159; C 6.25–6.75″ / 159–171; D 6.75–7.5″ / 171–191; E >7.5″ / >191. Измерить мягкой лентой в точке ношения, без затягивания; повторить вечером.

### Q3. Mechanical vs operational friction — soft/hard `maintenance_profile`
A zero_maintenance: кварц/solar, минимальное вмешательство. B workhorse: механика допустима, сервис раз в несколько лет. C in_house: готовность к дорогому/долгому сервису и сложным калибрам.

### Q4. Среда эксплуатации — hard filter WR/удар/магнетизм
A офис/события; B смешанный ежедневный режим; C вода, спорт, инструменты, сильные магнитные поля. Для C требовать WR 100 м+, завинчиваемую головку по сценарию и проверку прокладок.

### Q5. Социальный сигнал — soft `social_signals`
A anti_luxury; B discreet_competence; C quiet_continuity; D unapologetic_success.

### Q6. Эстетическая ДНК — soft `aesthetic_dna`
A structural_tool; B mid_century; C integrated_geometry; D extravagant_creative; E high_art.

### Q7. Провенанс / корпоративная структура — soft `ownership_type`, `lineage_continuity`
A только независимая семейная/фонд; B допустим холдинг при реальной мануфактуре; C структура несущественна.

### Q8. Ядровая цель — soft
A единственный надёжный предмет; B инженерное любопытство; C преемственность/ритуал; D признание и статус.

### Q9. Отношение к хайпу — soft/negative `market_momentum`, `hype_risk`
Выбрать macro_trend / evergreen / insider_hype / contrarian. `speculative_bubble` не является желаемым ответом: это предупреждение системы.

## Добавленные оси Q10–Q16

### Q10. Форма верхней поверхности запястья — hard fit geometry
A плоская; B средняя; C круглая/узкая. При одинаковом обхвате плоская верхушка переносит больший L2L; на круглой крайние ушки раньше нависают. Фильтрует L2L, кривизну ушек и интегрированный первый линк ([руководство lug²lug](https://www.lug2lug.org/tools/wrist-fit)).

### Q11. Крепление и смена ремня — soft/hard serviceability
A браслет, микро-регулировка обязательна; B быстрый QuickSwitch/quick-release; C обычные пружинные шпильки допустимы; D ремень менять не планируется. Быстрая смена полезна только при совместимых ремнях; интегрированная геометрия ограничивает выбор ([руководство StrapHabit](https://straphabit.com/blogs/straphabit-reviews/straphabit-guide-to-choosing-a-watch-strap-band-or-bracelet)).

### Q12. Allocation friction — hard commercial filter
A только товар в наличии по MSRP; B подожду до 6–12 месяцев; C готов к истории покупок; D допустим серый рынок; E допустима премия ___%. Убирает `дефицит-waitlist` и `hype_risk=high`, если A. Waitlist не равен гарантированной очереди, а серый рынок меняет цену и гарантийный маршрут ([Bob’s Watches](https://www.bobswatches.com/rolex-blog/editorial/new-rolex-vs-used-rolex.html)).

### Q13. Остаточная стоимость — soft/negative `liquidity`
A не важна; B хочу ≥60% розницы; C ≥80%; D максимум ликвидности. Использовать как предпочтение, не обещание: состояние, комплект, референс и спред дилера меняют итог ([Chrono24](https://www.chrono24.com/)).

### Q14. Роль в коллекции — soft diversity vector
A единственные часы; B первые механические; C ежедневная ротация 2–4; D коллекция 5+; E узкая ниша/усложнение. Для A повышать workhorse, WR и нейтральность; для D/E — contrarian, high_art и специализированные усложнения.

### Q15. Чувствительность к весу — hard/soft material filter
A <80 г; B 80–130 г; C вес не важен; D хочу ощутимую массу. Титан легче стали и обычно комфортнее при крупном корпусе, но субъективно может казаться менее «существенным» ([aBlogtoWatch](https://www.ablogtowatch.com/titanium-watch-guide/)). Фильтрует материал и массу в сборе.

### Q16. Читаемость, темнота и рука — hard accessibility
A сильный lume обязателен; B достаточно дневной контрастности; C нужна подсветка/цифровая индикация; D ношу на левой руке; E на правой; F головка не должна давить на кисть. Для правой руки рассмотреть crown-left/destro или короткую головку; читаемость оценивать по реальному циферблату, не только фото ([Esquire о left-handed watches](https://www.esquire.com/uk/watches/g33818954/left-handed-watches/)).

## Логика скоринга

1. Применить hard filters: Q1, Q2+Q10, Q4, обязательные части Q11/Q12/Q15/Q16.
2. Отсечь записи с отсутствующими критическими данными либо запросить примерку.
3. Рассчитать soft similarity по Q3, Q5–Q9, Q11, Q13–Q16.
4. Наложить штраф: hype_risk=high при Q9=contrarian; liquidity=low при Q13=C/D; in_house при Q3=A.
5. Выдать 3 кандидата разных архетипов и объяснить, какой hard filter и какой soft vector привёл к каждому.

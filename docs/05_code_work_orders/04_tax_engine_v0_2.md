# Code 작업지시서 04 — tax_engine.js v0.2 + 회귀 테스트 v0.2

| 항목 | 내용 |
|---|---|
| 문서 ID | `docs/05_code_work_orders/04_tax_engine_v0_2.md` |
| 버전 | v0.2.0 |
| 작성일 | 2026-05-02 |
| 작성 출처 | 작업 창 #9 (작업지시서 04 작성 전용) |
| 작업 대상 | Claude Code |
| 선행 작업 | 작업지시서 01 (`docs/05_code_work_orders/01_tax_rules.md`) ✅ 완료 (Node.js 67/0) / 작업지시서 02 (`docs/05_code_work_orders/02_tax_engine.md`) ✅ 완료 (Node.js 234/0 + GitHub Pages 라이브 검증) / **작업지시서 03 (`docs/05_code_work_orders/03_tax_rules_v0_2.md`) ✅ 완료 (Node.js 150/0 + 234/0 회귀 + selfTest ok, 5/1, commit 8612cad)** |
| 후속 작업 | 작업지시서 05 (`scenario_engine.js` v0.3) — 본 작업 산출 후 작성 |
| 입력 자료 | `docs/v0.2/modules/tax_engine.md` v0.2.1 (단일 진본) + `docs/v0.2/modules/tax_rules.md` v0.2.0 (호출 대상 read-only) |
| 의사결정 준수 | #5 강화 (법령 개정 대응 아키텍처 — 단일 소스/룩업 우선/산식 흐름 분리), #6 (영속화 의무), **#9 v9 (.js 본문 산출 금지)**, #11 (정확성 > 속도) |
| 백로그 반영 | **B-019 (자동 보정 — 본 모듈 `validateCaseData`에서 처리)**, **B-020 (의사결정 #5 강화 — §0-1 사전 적용)**, **B-024 (tax_engine.md v0.2.1 §8-1 별칭 정정 — 백로그 등록 권고)**, B-022 (정수 처리 — v0.2.1 결정 그대로 유지), B-023 (부칙·경과규정 — v0.5+ 인계) |

---

## 0. 작업 목표 — 한 문장 요약

`tax_engine.js`를 v0.1.1 → v0.2.0으로 패치하여 (1) **단계 2 1세대1주택 비과세 본문 활성** (`check1Se1HouseExemption` 결정 트리), (2) **단계 3 고가주택 12억 초과 안분 본문 활성** (`calculateHighValuePortion`), (3) **단계 4 장특공 표 1·표 2 분기 본문 활성** (`calculateLongTermDeduction` — `tax_rules.findHoldingRate`·`findResidenceRate` 룩업 호출), (4) **`validateCaseData` v0.2 신규 검증 5종 + 자동 보정 7종**, (5) **`result.steps` v0.2 신규 필드 10종 추가**, (6) **`collectIssueFlags` 카탈로그 18종으로 확장**을 구현하고, **v0.1.1 함수 시그니처·반환 형식·v0.1 회귀 테스트 234건을 그대로 보존** (단 `RULE_VERSION` strict-eq 1라인 갱신 예외)한다.

본 작업의 성공 기준은 다음 3가지를 동시 충족하는 것이다.

| # | 기준 | 검증 방법 |
|---|---|---|
| (a) | **v0.1 회귀 테스트 234건이 그대로 통과** (RULE_VERSION 1라인 strict-eq 갱신 예외) | `node tests/tax_engine.test.js` |
| (b) | **TC-006~010 5건 totalTax 정합** (검증팀 손계산 + 홈택스 모의계산 + Claude 코드 3자 일치) | `node tests/tax_engine.test.js` v0.2 그룹 + GitHub Pages 라이브 검증 |
| (c) | **`taxEngine.selfTest().ok === true`** + 부트스트랩 가드 통과 (`tax_rules.js` v0.2 24종 노출 확인) | 부트스트랩 1회 호출 |

산식·상수·issueFlag 발동 조건은 모두 `docs/v0.2/modules/tax_engine.md` v0.2.1 §2~§8 + `docs/v0.2/01_calc_engine_spec.md` v0.2.1 §2~§8을 단일 정본으로 한다. 본 작업지시서는 모듈 스펙·명세서를 코드로 옮기는 절차서다.

### 0-1. 산출물 분담 (의사결정 #9 v9 재확인)

| 산출물 | 산출 주체 | 본 작업지시서의 역할 |
|---|---|---|
| `js/tax_engine.js` (v0.1 → v0.2 패치) | **Claude Code** | 사양·체크리스트 제공 |
| `tests/tax_engine.test.js` (v0.2 회귀 테스트 추가) | **Claude Code** | 회귀 보존·신규 검증 항목 제공 |
| `docs/05_code_work_orders/04_tax_engine_v0_2.md` | 작업 창 #9 (본 문서) | 1회 작성, 영속화 후 인계 |
| `js/tax_rules.js` v0.2.0 패치 | (작업지시서 03 — ✅ 완료) | 본 작업 범위 외 (read-only 의존) |
| `tests/tax_rules.test.js` v0.2.0 패치 | (작업지시서 03 — ✅ 완료) | 본 작업 범위 외 |

본 작업 창은 .js 코드 본문을 산출하지 않는다. 본 문서의 코드 골격(13단계 의사코드·함수 시그니처·issueFlag 발동 조건 표)은 **참고용 reference skeleton**이며, 완성된 .js 파일은 Claude Code가 본 문서 + 모듈 스펙 v0.2.1 + v0.1 기존 코드(`js/tax_engine.js`)를 함께 참조하여 작성한다.

### 0-2. v0.1.1 → v0.2.0 변경 한 문장 요약

**13단계 파이프라인 골격은 그대로 유지하면서 단계 0(검증 보강) + 단계 2(비과세) + 단계 3(안분) + 단계 4(장특공) 4단계의 본문을 활성화하고, 호출 측이 `tax_rules.js` v0.2의 24종 노출 멤버를 사용하도록 전환한다.** 단계 1·5·6·7·8·9·10·11·12·13은 v0.1.1 본문 그대로다.

---

## 1. 선행 자료 (Claude Code가 먼저 읽어야 하는 문서·코드)

다음 자료를 본 작업지시서와 함께 읽는다. 충돌 시 우선순위는 위 → 아래 순.

| 우선순위 | 자료 | 역할 |
|---|---|---|
| 1 | `docs/v0.2/modules/tax_engine.md` v0.2.1 (검증 통과 + 산식 표기 정정) | **단일 진본** — v0.2 단계 2·3·4 함수 계약 정본 |
| 2 | `docs/v0.2/01_calc_engine_spec.md` v0.2.1 (§0-1·§3·§4·§5·§6·§7·§8) | 산식·issueFlag·검증·자동 보정 정본 |
| 3 | `docs/v0.2/modules/tax_rules.md` v0.2.0 (820줄, 호출 대상 read-only) | 24종 노출 멤버 인터페이스 |
| 4 | `docs/v0.1/modules/tax_engine.md` v0.1.1 (235줄) | v0.1 베이스 — 17종 노출 멤버 그대로 보존 + 단계 5~13 산식 그대로 |
| 5 | `docs/v0.1/01_calc_engine_spec.md` v0.1.1 (검증 통과) | v0.1 산식 정본 (단계 5~13 변경 없음) |
| 6 | `js/tax_engine.js` (현 v0.1.1 코드, 234/0 회귀 통과) | v0.1 패턴 (IIFE·`globalThis` fallback·13단계 함수 분리·검증 함수 패턴) |
| 7 | `js/tax_rules.js` (v0.2.0 영속화, 5/1 commit 8612cad) | 호출 대상 실제 코드 — 24종 노출 멤버 |
| 8 | `tests/tax_engine.test.js` (v0.1.1 회귀 234건) | 회귀 보존 대상 — 그대로 통과 필수 (RULE_VERSION 1라인 예외) |
| 9 | `docs/v0.2/06_test_cases.md` v0.2.1 (TC-006~010 검증 결과) | 본 모듈 v0.2 회귀 검증 골든셋 + v0.1 입력 패치 (`householdHouseCount: 2`) |
| 10 | `docs/v0.2/03_input_schema.md` v0.2.0 | caseData 구조 (v0.2 신규 필드 + 자동 보정 룰) |
| 11 | `docs/99_decision_log.md` v12 (#5 강화·#9 v9·#11) | 코드 아키텍처 원칙 |
| 12 | `docs/98_backlog.md` (B-019·B-020·B-022·B-023·B-024) | 본 모듈과 직접 연관 백로그 |

> **읽는 순서 권고**: ① 본 작업지시서 §0~§3로 큰 그림 파악 → ② `docs/v0.2/modules/tax_engine.md` v0.2.1 §1~§8 정독 (단일 진본) → ③ 명세서 v0.2.1 §3~§5 정독 (산식 정본) → ④ 현 `js/tax_engine.js` v0.1.1 정독 (13단계 분리·IIFE·`globalThis` fallback 패턴 그대로 계승) → ⑤ `js/tax_rules.js` v0.2.0 정독 (호출 인터페이스 확인) → ⑥ 본 작업지시서 §4~§13 순으로 코드 작성. 산식 의문 발생 시 모듈 스펙 v0.2.1이 정본, 모듈 스펙과 명세서가 충돌하면 명세서 v0.2.1이 정본.

---

## 2. 산출 파일 목록

### 2-1. `js/tax_engine.js` (v0.1.1 → v0.2.0 패치)

| 항목 | 내용 |
|---|---|
| 위치 | `js/tax_engine.js` (repo root) |
| 변경 유형 | 기존 파일 패치 (신규 생성 아님) |
| v0.1 노출 멤버 보존 | **17종 시그니처·반환 형식 그대로** (단 `ENGINE_VERSION` 문자열만 갱신: `"v0.1.1"` → `"v0.2.0"`) |
| v0.2 신규 노출 추가 | **3종** — `check1Se1HouseExemption`, `calculateHighValuePortion`, `calculateLongTermDeduction` (모듈 스펙 §2-2 신규 멤버 표) |
| `result.steps` 신규 필드 | **10종** (모듈 스펙 §4-2 v0.2 보강 표) |
| issueFlag 카탈로그 | **10종 → 18종** (신규 5 + 보조 3, 변경 5, 유지 5, 폐기 1) |
| `tax_rules.js` 의존 | v0.1 9종 + **v0.2 신규 6종 = 15종** 사용 (모듈 스펙 §8-1 표) |
| 신규 행수 추정 | +400~+600줄 (v0.1 약 800줄 → v0.2 약 1,200~1,400줄) — Claude Code가 결정 |

### 2-2. `tests/tax_engine.test.js` (v0.1 → v0.2 패치)

| 항목 | 내용 |
|---|---|
| 위치 | `tests/tax_engine.test.js` (repo root) |
| 변경 유형 | 기존 파일 패치 (신규 생성 아님) |
| v0.1 회귀 케이스 보존 | **234건 그대로** (수정·삭제·치환 금지, 단 §2-3 단서 적용) |
| v0.2 신규 회귀 케이스 | TC-006~010 5건 13개 항목 검증 + 단계 2·3·4 단위 테스트 + 분기 회귀 + selfTest 보강 검증 + caseData 입력 패치 회귀 등. 정확한 건수는 Claude Code가 §10-2 항목을 빠짐없이 포함하여 결정 |
| 출력 형식 | v0.1 패턴 그대로 — `=== tax_engine v0.2.0 회귀 테스트 ===` 헤더 + 그룹별 통과 표시 + 마지막 줄 `총 N건 통과 / 0건 실패` |
| 예상 총 건수 | **234 + N** (N ≈ 80~120, Claude Code 재량) |

### 2-3. 변경 금지 정책 + 예외 단서 (인계 2 적용)

본 작업은 다음 파일을 **변경하지 않는다**.

- `js/tax_rules.js` (v0.2.0 영속화, 5/1 commit 8612cad — 작업지시서 03 단일 책임)
- `tests/tax_rules.test.js` (v0.2.0 영속화 — 작업지시서 03 단일 책임)
- `docs/v0.1/01_calc_engine_spec.md` (검증 완료, 정본)
- `docs/v0.2/01_calc_engine_spec.md` v0.2.1 (검증 완료, 정본)
- `docs/v0.1/06_test_cases.md` (TC-001~005 골든셋, 정답값 변경 금지)
- `docs/v0.2/06_test_cases.md` v0.2.1 (TC-006~010 골든셋, 정답값 변경 금지)
- `docs/v0.1/modules/tax_engine.md` v0.1.1 (정본)
- `docs/v0.2/modules/tax_engine.md` v0.2.1 (정본 — §8-1 별칭 정정은 본 작업지시서 외부 작업, B-024 등록 권고)
- `docs/v0.2/modules/tax_rules.md` v0.2.0 (정본)

#### 2-3-1. `tests/tax_engine.test.js` 변경 정책 (인계 2 명문화)

작업지시서 03 §2-3은 본 파일을 "변경 금지"로 명시했으나, 5/1 Claude Code 실행 결과 **`RULE_VERSION` strict-eq 비교 라인 1줄 갱신**이 발생했다 (호출 측 모듈 v0.1.1 → v0.2.0 갱신에 따라 `tax_rules.RULE_VERSION === "v0.1.1-post-20260510"` 검증 라인이 `"v0.2.0-post-20260510"`로 갱신됨, commit 8612cad).

본 작업지시서 04는 위 사실을 반영하여 다음 예외 단서를 명문화한다.

| 변경 정책 | 내용 |
|---|---|
| **원칙** | `tests/tax_engine.test.js` v0.1.1 회귀 234건은 **그대로 보존**. 수정·삭제·치환 금지 |
| **예외 (a)** | `RULE_VERSION` strict-eq 비교 라인 1줄 갱신 가능 (호출 측 모듈이 v0.2.0이 됐으므로). v0.1 회귀 234건 중 1건이 이미 5/1 갱신되어 `"v0.2.0-post-20260510"`로 비교 중. 본 작업에서 **추가 갱신 불필요** (이미 갱신됨) |
| **예외 (b)** | v0.2 신규 회귀 테스트 추가는 **자유** (예: v0.2 그룹 헤더, TC-006~010 검증 케이스, 단계 2·3·4 단위 테스트). 단 v0.1 회귀 234건이 그대로 통과해야 함 |
| **예외 (c)** | `ENGINE_VERSION` strict-eq 비교 라인이 v0.1 회귀에 있다면 갱신 가능 (`"v0.1.1"` → `"v0.2.0"`). 단 v0.1 회귀 검증 의도가 깨지지 않는 범위 |
| **충돌 시 우선순위** | (1) 회귀 보존 (234건) > (2) strict-eq 갱신 > (3) "변경 금지" 원칙 |

> **본 단서의 의의**: 5/1 commit 8612cad에서 발생한 1라인 갱신은 **회귀 테스트의 검증 의도(호출 측 모듈 정합성)를 보존**하면서 **호출 측 변경에 자동 적응**하는 형태였다. 본 작업지시서는 이 패턴을 그대로 인정한다. v0.1 회귀 의도(13단계 산식 정합·TC-001~005 골든셋·issueFlag 발동·정수 산술 보장·B-008 metrics)가 깨지지 않는 한 strict-eq 라인 갱신은 회귀 위반이 아니다.

---

## 3. tax_engine.js v0.2 변경 요약

### 3-1. v0.1 17종 노출 멤버 시그니처·반환 형식 그대로 유지

다음 17종은 **이름·시그니처·반환 형식 모두 v0.1.1 그대로**다. v0.2 패치 후에도 v0.1 회귀 테스트 234건이 깨지지 않아야 한다.

| 카테고리 | 멤버 | v0.2 변경 |
|---|---|---|
| 메타 (1종) | `ENGINE_VERSION` | 문자열만 갱신: `"v0.1.1"` → `"v0.2.0"` |
| 메인 진입점 (1종) | `calculateSingleTransfer(caseData, houseId?)` | 시그니처 그대로. 본문 보강 (단계 2·3·4 활성, `result.steps`에 v0.2 필드 추가) |
| 검증 (1종) | `validateCaseData(caseData)` | 시그니처 그대로. 본문 보강 (v0.2 신규 검증 5종 + 자동 보정 7종) |
| 13단계 함수 (13종) | `computeTransferGain` ~ `computeNetAfterTaxSaleAmount` | 시그니처 그대로. 단계 2·3·4 본문 활성. 단계 1·5~13 본문 변경 없음 |
| metrics (1종) | `computeEffectiveTaxRate(totalTax, salePrice)` | 시그니처·반환 형식 그대로 |
| issueFlag 수집 (1종) | `collectIssueFlags(caseData, intermediates)` | 시그니처 그대로. 카탈로그 18종으로 확장. `intermediates` 입력에 v0.2 신규 필드 5종 추가 |
| 자체검증 (1종) | `selfTest()` | 시그니처·반환 형식 그대로. sanity 케이스 보강 (TC-006·008·010 권장 추가 — 모듈 스펙 §6-1) |

> **`ENGINE_VERSION` 갱신**: `result.engineVersion` 필드에 기록되는 값. v0.1 회귀 테스트가 본 값을 단순 비교하지 않고 패턴 또는 존재 확인만 한다면 회귀 영향 없음. 만약 단순 문자열 일치 검증 라인이 있다면 §2-3 예외 (c)로 처리.

### 3-2. v0.2 신규 분기 (단계 2·3·4 활성)

다음 4단계의 본문이 v0.1.1 passthrough/0 고정 → v0.2.0 활성으로 전환된다 (모듈 스펙 §0-1, 명세서 §0).

| 단계 | v0.1.1 동작 | v0.2.0 동작 | 본 작업지시서 §X |
|---|---|---|---|
| 0 | 8개 필드 검증 | 13개 필드 검증 + 자동 보정 7종 | §4-0, §8 |
| 2 | passthrough (`taxableGain = transferGain`) | **1세대1주택 비과세 결정 트리** | §4-2 |
| 3 | passthrough (`taxableGain` 유지) | **12억 초과 안분 산식** | §4-3 |
| 4 | `longTermDeduction = 0` | **표 1·표 2 분기 + 룩업 호출** | §4-4 |

### 3-3. v0.2 신규 노출 함수 3종 (모듈 스펙 §2-2 신규 멤버)

본 작업으로 다음 3종이 새로 노출된다 (`window.TaxOpt.taxEngine`).

| 함수 | 시그니처 | 사용처 | 본 작업지시서 §X |
|---|---|---|---|
| `check1Se1HouseExemption(input)` | input: `{ householdHouseCount, acquisitionDate, saleDate, acquisitionRegulated, residenceMonths, salePrice }` → output: `{ is1Se1House, isHighValueHouse, terminateAt2, holdingYears, residenceYears, reason }` | 단계 2 내부 호출 + v0.3 시나리오 엔진 재사용 | §4-2-1 |
| `calculateHighValuePortion(input)` | input: `{ transferGain, salePrice }` → output: `{ taxableGain, allocationRatio }` | 단계 3 내부 호출 + v0.3 시나리오 엔진 재사용 | §4-3-1 |
| `calculateLongTermDeduction(input)` | input: `{ taxableGain, holdingYears, residenceYears, is1Se1House, isHighValueHouse }` → output: `{ longTermDeduction, appliedDeductionTable, holdingRate, residenceRate, totalRate }` | 단계 4 내부 호출 + v0.3 시나리오 엔진 재사용 | §4-4-1 |

> **노출 원칙**: v0.1과 동일. 13단계 각 함수와 v0.2 신규 보조 함수 3종을 모두 노출하는 이유는 (1) 회귀 테스트가 단계별 중간값을 검증해야 하고, (2) v0.3 시나리오 엔진이 일부 단계만 재사용할 수 있어야 하기 때문 (모듈 스펙 §2 말미). 노출은 **읽기 전용 사용**을 전제로 한다 (불변성 약속, 모듈 스펙 §7).

### 3-4. 호출 대상 변경 — `tax_rules.js` v0.2.0 (24종 노출 멤버)

본 모듈은 `tax_rules.js` v0.2.0의 **24종 노출 멤버**를 read-only로 사용한다 (인계 3 정확화: v0.1 17종 + v0.2 신규 7종 = 24종, 시스템 프롬프트의 "v0.1 13종" 표기는 모듈 스펙·작업지시서 03과 충돌하므로 24종 = 17 + 7 정본 채택).

| `tax_engine.js` 단계 | 사용 멤버 | v0.1/v0.2 |
|---|---|---|
| 단계 0 (validateCaseData) | `APPLICABLE_SALE_DATE_FROM` | v0.1 |
| **단계 2 (1세대1주택 비과세)** | **`HIGH_VALUE_HOUSE_THRESHOLD`, `NON_TAXABLE_HOLDING_MIN_YEARS`, `NON_TAXABLE_RESIDENCE_MIN_YEARS`** | **v0.2 신규** |
| **단계 3 (고가주택 안분)** | **`HIGH_VALUE_HOUSE_THRESHOLD`** | **v0.2 신규** |
| **단계 4 (장특공)** | **`LONG_TERM_DEDUCTION_TABLE_1`, `LONG_TERM_DEDUCTION_TABLE_2_HOLDING`, `LONG_TERM_DEDUCTION_TABLE_2_RESIDENCE`, `findHoldingRate`, `findResidenceRate`** | **v0.2 신규** |
| 단계 6 (기본공제) | `BASIC_DEDUCTION_AMOUNT` | v0.1 |
| 단계 8~9 (보유기간 분기·세율) | `SHORT_TERM_RATE_UNDER_1Y`, `SHORT_TERM_RATE_UNDER_2Y`, `PROGRESSIVE_BRACKETS`, `findBracket` | v0.1 |
| 단계 11 (지방소득세) | `LOCAL_INCOME_TAX_RATE` | v0.1 |
| issueFlag 수집 | `APPLICABLE_SALE_DATE_FROM`, `HOLDING_PERIOD_BOUNDARY_YEARS`, `LAW_REFS`, `UNREGISTERED_RATE` | v0.1 + **v0.2 신규 (`HOLDING_PERIOD_BOUNDARY_YEARS`)** |
| 결과 객체 메타 | `RULE_VERSION`, `LAW_REFS` | v0.1 (값 갱신만) |
| 부트스트랩 | `selfTest()` | v0.1 |

> **인계 3 정확화 — v0.1 노출 멤버 수**: 시스템 프롬프트의 "v0.1 13종" 표기는 모듈 스펙 v0.1.1·v0.2.0 §2-2 + 작업지시서 03 §3-1의 "v0.1 17종" 표기와 충돌한다. 본 작업지시서는 모듈 스펙·작업지시서 03 정본을 따른다 (**v0.1 17종 + v0.2 신규 7종 = 24종**). 시스템 프롬프트 표기 정정은 본 관제탑 책임 (백로그 등록 권고).

> **v0.1 17종 카테고리 분해 (작업지시서 03 §3-1 참조)**: 메타데이터 3종 + 금액·세율 상수 5종 + 룩업 테이블 1종 (`PROGRESSIVE_BRACKETS`) + 헬퍼 함수 1종 (`findBracket`) + 자체검증 함수 4종 (`selfTest`·`verifyProgressiveContinuity`·`verifyBaseTaxAreIntegers`·`verifyMonotonic`) + 잔여 3종 = 17종. (정확한 v0.1 17종 분해는 v0.1 모듈 스펙 v0.1.1 §2 또는 작업지시서 03 §3-1 표 정독.)

### 3-5. 산출물 행수 추정

| 영역 | v0.1.1 | v0.2.0 추정 | 증가 |
|---|---|---|---|
| `js/tax_engine.js` | 약 800줄 | 약 1,200~1,400줄 | +400~+600 |
| `tests/tax_engine.test.js` | 약 1,000줄 | 약 1,400~1,800줄 | +400~+800 |

> 정확한 행수는 Claude Code가 결정. 본 추정치는 산출 분량 가늠용.


---

## 4. 13단계 산식 파이프라인 함수 계약

각 단계는 모듈 스펙 v0.2.1 §5와 동일하다. 본 절은 **Claude Code 구현 관점**에서 입출력·산식·예외처리·issueFlag 트리거를 정리한다. **단계 1·5·6·7·8·9·10·11·12·13은 v0.1.1과 완전 동일**하므로 v0.1 작업지시서 02 §3에 위임하고 본 작업지시서는 **단계 0·2·3·4 변경분만 상세 기술**한다.

### 4-0. 단계 0 — `validateCaseData(caseData)` (v0.2 보강)

| 항목 | 내용 |
|---|---|
| 입력 | `caseData` 전체 (v0.2 신규 필드 포함) |
| 출력 | `{ ok: boolean, errors: string[], warnings: string[], correctedCaseData?: object, autoCorrections: string[] }` |
| 호출 측 처리 | `ok === false` 시 `calculateSingleTransfer`는 `Error` throw. `ok === true && autoCorrections.length > 0`이면 `correctedCaseData`로 후속 처리 (입력 변경 금지 원칙 보존) |

검증 항목 (명세서 v0.2.1 §7 + v0.1.1 §8):

```
[v0.1 검증 그대로 유지 — 8개]
1. salePrice           : Number.isInteger && >= 1            → 실패: 에러
2. acquisitionPrice    : Number.isInteger && >= 1            → 실패: 에러
3. necessaryExpense    : Number.isInteger && >= 0            → 실패: 에러
4. acquisitionDate     : "YYYY-MM-DD" 패턴 유효              → 실패: 에러
5. saleDate            : "YYYY-MM-DD" 패턴 유효              → 실패: 에러
6. acquisitionDate < saleDate                                → 실패: 에러
7. saleDate.year === baseYear                                → 불일치: 경고
8. saleDate >= APPLICABLE_SALE_DATE_FROM ("2026-05-10")     → 미달: 경고

[v0.2 신규 검증 — 5개, 명세서 §7-2]
9.  householdHouseCount : Number.isInteger && >= 1           → 미달(0·음수): 에러. 누락: 자동 보정 (§4-0-2)
10. residenceMonths     : Number.isInteger && >= 0           → 음수: 에러. 누락: 0 자동 보정
11. livingNow           : boolean                            → 누락: false 자동 보정
12. isOneTimeTwoHouses  : boolean                            → 누락: false 자동 보정
13. acquisitionRegulated: boolean                            → 누락: false 자동 보정 (v0.1 호환)
```

> v0.1 검증 항목 9 (`!acquisitionRegulated && !saleRegulated`)는 v0.2에서 **발동 조건 축소**: v0.2는 `acquisitionRegulated === true`를 거주요건 판정에 사용하므로 v0.1 `OUT_OF_V01_SCOPE_REGULATED_AREA` issueFlag는 `saleRegulated === true`만 트리거 (명세서 §6-2). validateCaseData는 더 이상 양도시 비조정대상지역 위반을 경고하지 않음 — 다주택 중과 미적용 가정 그대로.

> 양도차손(`transferGain < 0`)은 1단계 산출 후에만 가능하므로 0단계에서는 검증하지 않는다. 1단계 결과를 받아 `collectIssueFlags`에서 `TRANSFER_LOSS_DETECTED` 처리 (v0.1과 동일).

#### 4-0-1. 자동 보정 룰 (B-019 — 명세서 §7-3)

| 필드 | 누락 시 자동 보정값 | issueFlag |
|---|---|---|
| `specialTaxFlags` (v0.1.2 사전) | `{ isFarmHouse: false, isHometownHouse: false, isPopulationDeclineAreaHouse: false, isLongTermRental: false }` | 없음 |
| `specialTaxRequirementsMet` (v0.1.2 사전) | `[]` | 없음 |
| **`householdHouseCount`** (v0.2) | `salePlan.candidateHouseIds.length`로 추정 (v0.1 회귀 안전성 — TC-001~005 골든셋 입력 패치 대신 자동 보정으로 회귀 회피 가능) | **`HOUSEHOLD_COUNT_INFERRED`** (info) |
| `isOneTimeTwoHouses` (v0.2) | `false` | 없음 |
| `livingNow` (v0.2 활성) | `false` | 없음 |
| `acquisitionRegulated` (v0.2 활성) | `false` | 없음 |
| **`residenceMonths`** (v0.2 활성) | `0` | **`RESIDENCE_MONTHS_DEFAULTED_ZERO`** (info) |

> **v0.1 회귀 안전성 — 골든셋 입력 패치 권장**: TC-001~005는 `householdHouseCount` 미입력 상태로 작성됨. 자동 보정 룰이 `salePlan.candidateHouseIds.length`로 추정하므로 v0.1 골든셋의 `candidateHouseIds: ["A", "B"]` 같은 다주택 케이스는 자동으로 `householdHouseCount = 2`로 보정되어 비과세 분기 회피. 그러나 안전을 위해 `docs/v0.1/06_test_cases.md` v0.1.2 패치(`householdHouseCount: 2` 명시 추가)를 함께 적용 권고 (명세서 v0.2.1 §9-1, 본 작업지시서 §11-2-7에서 결정).

#### 4-0-2. 참고 골격 (의사코드)

```
function validateCaseData(caseData) {
  var errors = [];
  var warnings = [];
  var autoCorrections = [];
  var corrected = deepClone(caseData);  // 입력 변경 금지 원칙

  // ─── v0.1 검증 8개 (그대로) ───
  var house = pickHouseFromCaseData(corrected);
  if (!Number.isInteger(house.expectedSalePrice) || house.expectedSalePrice < 1)
    errors.push('salePrice는 1 이상의 정수여야 합니다.');
  // ... v0.1.1 §8 8개 항목 그대로 ...

  // ─── v0.2 자동 보정 7개 ───
  if (typeof corrected.householdHouseCount === 'undefined') {
    corrected.householdHouseCount = corrected.salePlan.candidateHouseIds.length;
    autoCorrections.push('HOUSEHOLD_COUNT_INFERRED');
  } else if (!Number.isInteger(corrected.householdHouseCount) || corrected.householdHouseCount < 1) {
    errors.push('householdHouseCount는 1 이상의 정수여야 합니다.');
  }

  if (typeof house.residenceMonths === 'undefined') {
    house.residenceMonths = 0;
    autoCorrections.push('RESIDENCE_MONTHS_DEFAULTED_ZERO');
  } else if (!Number.isInteger(house.residenceMonths) || house.residenceMonths < 0) {
    errors.push('residenceMonths는 0 이상의 정수여야 합니다.');
  }

  // ... 나머지 5개 자동 보정 ...

  return {
    ok: errors.length === 0,
    errors: errors,
    warnings: warnings,
    correctedCaseData: errors.length === 0 ? corrected : null,
    autoCorrections: autoCorrections
  };
}
```

> 위 골격은 참고용. 정확한 구현은 Claude Code가 명세서 §7·§8 + 입력 스키마 v0.2.0 §5를 보고 결정. **`caseData` 입력 객체를 변경하지 않는다** (순수 함수 원칙, deep clone 후 보정).

### 4-1. 단계 1 — `computeTransferGain(input)` (v0.1 그대로)

```
산식: transferGain = salePrice − acquisitionPrice − necessaryExpense
출력: 정수 (음수 가능, 양도차손)
절사: 없음
```

v0.1.1 §3-1 그대로. 변경 없음.

### 4-2. 단계 2 — `applyNonTaxation(transferGain, caseData)` (v0.2 활성)

| 항목 | 내용 |
|---|---|
| 입력 | `transferGain` (number, 1단계 결과), `caseData` |
| 출력 | `{ taxableGain, nonTaxableGain, is1Se1House, isHighValueHouse, terminateAt2, holdingYears, residenceYears }` |
| 산식 | (1) `check1Se1HouseExemption({ householdHouseCount, acquisitionDate, saleDate, acquisitionRegulated, residenceMonths, salePrice })` 호출 → `{ is1Se1House, isHighValueHouse, terminateAt2, holdingYears, residenceYears, reason }`. (2) `terminateAt2 === true` 시 `{ taxableGain: 0, nonTaxableGain: transferGain, is1Se1House: true, isHighValueHouse: false, terminateAt2: true, ... }`. (3) `is1Se1House && isHighValueHouse` 시 `{ taxableGain: transferGain, nonTaxableGain: 0, ... }` (단계 3에서 안분 위임). (4) 비과세 미적용 시 `{ taxableGain: transferGain, nonTaxableGain: 0, is1Se1House: false, ... }` |
| 절사 | 본 단계 자체 절사 없음 (단계 3 안분 또는 단계 4·5에서 절사) |
| 부수효과 | 없음 |
| 결정성 | 동일 입력 → 동일 출력 |
| 예외 | `check1Se1HouseExemption` 내부 예외 발생 시 throw |
| issueFlag 트리거 | `IS_1SE_1HOUSE` (`is1Se1House=true` 시), `RESIDENCE_MONTHS_USER_INPUT` (항상), `RESIDENCE_EXEMPTION_NOT_HANDLED` (`acquisitionRegulated && residenceMonths < 24` 시), `ONE_TIME_2HOUSES_NOT_APPLIED` (`isOneTimeTwoHouses=true` 시 — 본 단계에서 발동, 비과세 적용은 안 함, warning) |

#### 4-2-1. 보조 — `check1Se1HouseExemption(input)` (v0.2 신규 노출)

명세서 §3 결정 트리를 그대로 옮긴다.

```
결정 트리 (명세서 §3-1)

input = { householdHouseCount, acquisitionDate, saleDate, acquisitionRegulated, residenceMonths, salePrice }

(a) householdHouseCount === 1 ?
    NO  → return { is1Se1House: false, terminateAt2: false, isHighValueHouse: false, reason: "MULTI_HOUSE" }
    YES → 다음

(b) holdingYears = computeHoldingYears(acquisitionDate, saleDate)  // 동월동일 비교
    holdingYears >= NON_TAXABLE_HOLDING_MIN_YEARS (= 2년) ?
    NO  → return { is1Se1House: false, ..., reason: "HOLDING_LT_2Y" }
    YES → 다음

(c) acquisitionRegulated === true ?
    NO  → 거주요건 면제 → 다음 (e)
    YES → residenceMonths >= NON_TAXABLE_RESIDENCE_MIN_YEARS * 12 (= 24개월) ?
          NO  → return { is1Se1House: false, ..., reason: "RESIDENCE_LT_24M_REGULATED" }
                + RESIDENCE_EXEMPTION_NOT_HANDLED (info) issueFlag
          YES → 다음 (e)

(e) is1Se1House = true 확정 → 12억 비교
    salePrice <= HIGH_VALUE_HOUSE_THRESHOLD (= 1,200,000,000) ?
    YES → return { is1Se1House: true, terminateAt2: true, isHighValueHouse: false,
                   holdingYears, residenceYears: floor(residenceMonths/12),
                   reason: "EXEMPT_UNDER_12B" }
    NO  → return { is1Se1House: true, terminateAt2: false, isHighValueHouse: true,
                   holdingYears, residenceYears: floor(residenceMonths/12),
                   reason: "HIGH_VALUE_ALLOCATION" }
```

> **임계 명칭 정본 채택 (인계 1)**: 호출 측 비교 식은 `tax_rules.NON_TAXABLE_HOLDING_MIN_YEARS` (= 2년)·`tax_rules.NON_TAXABLE_RESIDENCE_MIN_YEARS` (= 2년)·`tax_rules.HIGH_VALUE_HOUSE_THRESHOLD` (= 1,200,000,000원)을 사용한다. tax_engine.md v0.2.1 §8-1에 표기된 별칭 `EXEMPTION_HOLDING_THRESHOLD_YEARS`·`EXEMPTION_RESIDENCE_THRESHOLD_MONTHS`는 **사용 금지** (모듈 스펙 v0.2.0 tax_rules.md §3-5와 충돌하므로 정본 명칭 채택). 거주 비교 식은 `residenceMonths >= NON_TAXABLE_RESIDENCE_MIN_YEARS * 12`로 작성 (단위 변환은 호출 측 책임).

> **거주연수 산정**: `residenceYears = Math.floor(residenceMonths / 12)`. 본 함수가 산출하여 반환한 값을 단계 4가 그대로 사용한다 (재산정 금지, 명세서 §5-5).

#### 4-2-2. 보유연수 산정 — 동월동일 비교 (v0.1.1 §3 그대로)

```
holdingYears = floor((saleDate − acquisitionDate)/365.25)  // 단순 산식 표기

[v0.1.1 §3 정확 알고리즘]
addYearsAnchored(date, n):
  // 윤년 2/29 처리: n년 후 동월동일이 존재하지 않으면 직전일(2/28)로 anchored
  ...

holdingYears 산정:
  1. saleDate >= addYearsAnchored(acquisitionDate, n) 가장 큰 n을 찾는다
  2. n이 holdingYears

[비과세 보유요건 비교]
saleDate >= addYearsAnchored(acquisitionDate, NON_TAXABLE_HOLDING_MIN_YEARS)
                                              (= 2년)
```

v0.1.1 §3 알고리즘을 그대로 사용. 윤년 2/29 처리 동일.

#### 4-2-3. issueFlag 트리거 정리 (단계 2)

| issueFlag | 발동 조건 | severity |
|---|---|---|
| `IS_1SE_1HOUSE` | `is1Se1House === true` (단계 2 결과) | info |
| `RESIDENCE_MONTHS_USER_INPUT` | 항상 | info |
| `RESIDENCE_EXEMPTION_NOT_HANDLED` | `acquisitionRegulated === true && residenceMonths < 24` | info |
| `ONE_TIME_2HOUSES_NOT_APPLIED` | `caseData.isOneTimeTwoHouses === true` | warning |
| `POSSIBLE_NON_TAXATION_1H1H` | `is1Se1House === false && householdHouseCount === 1 && holdingYears >= 2 && residenceMonths >= 24` (잠재 가능 케이스) | info |

### 4-3. 단계 3 — `applyHighValueAllocation(taxableGain, caseData)` (v0.2 활성)

| 항목 | 내용 |
|---|---|
| 입력 | `taxableGain` (단계 2 결과), `caseData`, 단계 2의 `isHighValueHouse` |
| 출력 | `{ taxableGain, allocationRatio, isHighValueHouse }` |
| 산식 | (1) 단계 2의 `isHighValueHouse === false` 시 `{ taxableGain (그대로), allocationRatio: 1.0, isHighValueHouse: false }` 통과 (절사 없음). (2) `isHighValueHouse === true` 시 `calculateHighValuePortion({ transferGain: taxableGain, salePrice })` 호출 |
| 절사 | 안분 적용 시 `Math.floor` 1회 (명세서 §4-3 절사 정책) |
| 부수효과 | 없음 |
| 결정성 | 동일 입력 → 동일 출력 |
| 예외 | salePrice ≤ 0 또는 salePrice ≤ 1,200,000,000인데 안분 진입 시 assertion throw (validateCaseData에서 사전 차단되어야 함) |
| issueFlag 트리거 | `IS_HIGH_VALUE_HOUSE` (안분 진입 + 비과세 적용 케이스, info), `HIGH_VALUE_HOUSE` (12억 초과 + 비과세 미적용 케이스, info) |

#### 4-3-1. 보조 — `calculateHighValuePortion(input)` (v0.2 신규 노출)

```
input  = { transferGain, salePrice }
output = { taxableGain, allocationRatio }

산식 (시행령 제160조 ① — 안분):
  allocationRatio = (salePrice − HIGH_VALUE_HOUSE_THRESHOLD) / salePrice
                  = (salePrice − 1,200,000,000) / salePrice
  taxableGain     = Math.floor(transferGain × allocationRatio)

[Math.floor 1회 — 명세서 §4-3]
- allocationRatio: 비율이므로 절사하지 않음 (JS Number 그대로)
- taxableGain: Math.floor로 정수 변환 (안분 직후 정수화하여 부동소수점 누적 오차 차단)

[예외]
- salePrice <= 1,200,000,000: throw (assertion 실패, validateCaseData에서 사전 차단)
- salePrice <= 0: throw (validateCaseData에서 사전 차단)
```

> **장특공 동시 안분 폐기 (수학적 동치)**: 시행령 제160조 ①의 본래 산식은 양도차익·장특공 양쪽에 안분비율을 곱한다. 본 모듈은 단계 3에서 양도차익만 1회 안분하고 단계 4에서 (안분 후 양도차익 × 공제율) 1회 곱셈으로 처리한다. 수학적으로 `(transferGain × ratio) × deductionRate = (transferGain × deductionRate) × ratio`로 동치이며 절사 위치만 단계 3 1회로 통일된다 (명세서 §4-3, 모듈 스펙 §5-2-1 말미).

### 4-4. 단계 4 — `computeLongTermDeduction(taxableGain, caseData)` (v0.2 활성)

| 항목 | 내용 |
|---|---|
| 입력 | `taxableGain` (단계 3 결과), `caseData`, 단계 2의 `holdingYears`·`residenceYears`·`is1Se1House`·`isHighValueHouse` |
| 출력 | `{ longTermDeduction, appliedDeductionTable, holdingRate, residenceRate, totalRate }` |
| 산식 | `calculateLongTermDeduction({ taxableGain, holdingYears, residenceYears, is1Se1House, isHighValueHouse })` 호출 결과 그대로 반환 |
| 절사 | `longTermDeduction = Math.floor(taxableGain × totalRate)` 1회 |
| 부수효과 | 없음 |
| 결정성 | 동일 입력 → 동일 출력 |
| 예외 | `holdingYears < 0` 등 음수 입력 시 throw |
| issueFlag 트리거 | `LONG_TERM_DEDUCTION_TABLE_1` (`appliedDeductionTable === 1`, info), `LONG_TERM_DEDUCTION_TABLE_2` (`appliedDeductionTable === 2`, info), `LONG_TERM_DEDUCTION_HOLDING_LESS_THAN_3Y_FOR_TABLE_2` (`is1Se1House && isHighValueHouse && holdingYears < 3`, info), `HOLDING_PERIOD_BOUNDARY` (1·2·3·15년 마크 ±3일 시) |

#### 4-4-1. 보조 — `calculateLongTermDeduction(input)` (v0.2 신규 노출 + v0.2.1 룩업 호출 패턴)

명세서 §5 + 모듈 스펙 §5-3-1을 그대로 옮긴다.

```
input  = { taxableGain, holdingYears, residenceYears, is1Se1House, isHighValueHouse }
output = { longTermDeduction, appliedDeductionTable, holdingRate, residenceRate, totalRate }

[v0.2.1 룩업 호출 패턴 — 의사결정 #5 강화 §0-1 원칙 (2)·(3)]

(a) 표 적용 자격 판정
    조건                                           | 적용 표         | appliedDeductionTable
    -----------------------------------------------|------------------|----------------------
    is1Se1House && isHighValueHouse && >= 3년    | 표 2            | 2
    is1Se1House && isHighValueHouse && < 3년     | 적용 없음       | null + flag
    그 외 (다주택 또는 1세대1주택 보유<3년)        | 표 1            | 1
    holdingYears < 3년                             | 적용 없음       | null

    > 12억 이하 비과세는 단계 2에서 종료되어 본 함수에 도달하지 않음 (상위 분기 차단)

(b) 표 1 적용 (appliedDeductionTable = 1)
    holdingRate = tax_rules.findHoldingRate(holdingYears, tax_rules.LONG_TERM_DEDUCTION_TABLE_1)
    residenceRate = 0
    totalRate = holdingRate
    
    > findHoldingRate가 클램프 내부 처리:
    >   < 3년 → 0 (이 경우 appliedDeductionTable = null로 별도 설정)
    >   3 ≤ holdingYears < 15 → 표 1 해당 행 (6%, 8%, ..., 28%)
    >   ≥ 15년 → 0.30 (클램프)

(c) 표 2 적용 (appliedDeductionTable = 2)
    holdingRate = tax_rules.findHoldingRate(holdingYears, tax_rules.LONG_TERM_DEDUCTION_TABLE_2_HOLDING)
    residenceRate = tax_rules.findResidenceRate(residenceYears, holdingYears, tax_rules.LONG_TERM_DEDUCTION_TABLE_2_RESIDENCE)
    totalRate = holdingRate + residenceRate
    
    > 룩업 함수 내부 클램프:
    >   findHoldingRate (표 2 좌측):
    >     < 3년 → 0, 3 ≤ holdingYears < 10 → 표 행 (12%, ..., 36%), ≥ 10년 → 0.40
    >   findResidenceRate (표 2 우측, 단서 적용):
    >     holdingYears < 3년 → 0 (단서 차단)
    >     residenceYears < 2년 → 0
    >     2 ≤ residenceYears < 3 → 0.08 (단서 행 활성, 보유 3년 이상 한정)
    >     3 ≤ residenceYears < 10 → 표 행 (12%, ..., 36%)
    >     residenceYears ≥ 10년 → 0.40
    
    > totalRate = holdingRate + residenceRate ≤ 0.80 (룩업 정의상 자동 보장)

(d) 공통 — 절사
    longTermDeduction = Math.floor(taxableGain × totalRate)

[법령 숫자 직접 보유 금지 — 명세서 §0-1 원칙 (3)]
본 함수는 0.06·0.02·0.04·0.40·0.30·0.08 등 법령 표 숫자를 직접 보유하지 않는다.
모든 공제율은 tax_rules.findHoldingRate / findResidenceRate 호출 결과만 사용한다.
v0.2.0 초안의 등차수열 산식 (`0.06 + (n−3) × 0.02`, `n × 0.04` 등)은 v0.2.1에서 폐기.
```

> **표 2 거주공제율 단서 (보유 3년 이상 + 거주 2~3년 미만 8%)** — `findResidenceRate(residenceYears, holdingYears, table)` 룩업 함수 내부에서 처리. 본 단계 함수는 단서 분기를 직접 다루지 않는다 (명세서 §5-3-3, 모듈 스펙 §5-3-1).

> **공제율 합계 80% 상한**: 표 2 룩업 좌측·우측 모두 최대 행 0.40으로 클램프되므로 `holdingRate + residenceRate ≤ 0.80`이 자동 보장. 별도 `Math.min(0.80, ...)` 가드 불필요. 방어적으로 추가해도 무방.

### 4-5. 단계 5 — `computeCapitalGainIncome(taxableGain, longTermDeduction)` (v0.1.1 그대로)

```
산식: capitalGainIncome = max(0, taxableGain − longTermDeduction)
```

v0.1.1 §3-5 그대로. 변경 없음. v0.2 단계 4가 0보다 큰 정수를 반환하므로 단계 5는 자동으로 양수 양도소득금액 산출. 단계 4가 0 (보유<3년)인 경우도 v0.1과 동일 동작.

### 4-6. 단계 6 — `computeBasicDeduction(basicDeductionUsed)` (v0.1.1 그대로)

```
산식: basicDeduction = basicDeductionUsed ? 0 : tax_rules.BASIC_DEDUCTION_AMOUNT (= 2,500,000)
```

v0.1.1 §3-6 그대로. 변경 없음. **상수 하드코딩 금지** (`tax_rules`에서 가져올 것).

### 4-7. 단계 7 — `computeTaxBase(capitalGainIncome, basicDeduction)` (v0.1.1 그대로)

```
산식: taxBase = max(0, capitalGainIncome − basicDeduction)
```

v0.1.1 §3-7 그대로. 변경 없음. 양도차손 시 `taxBase = 0` 보장.

### 4-8. 단계 8 — `determineHoldingPeriodBranch(acquisitionDate, saleDate)` (v0.1.1 그대로)

```
산식: 
  if saleDate < addYearsAnchored(acquisitionDate, 1) → "under1y"
  else if saleDate < addYearsAnchored(acquisitionDate, 2) → "under2y"
  else → "over2y"
```

v0.1.1 §3-8 그대로. 변경 없음. 동월동일 비교 알고리즘 그대로.

### 4-9. 단계 9 — `determineAppliedRate(branch, taxBase)` (v0.1.1 그대로)

```
산식:
  branch === "under1y" → SHORT_TERM_RATE_UNDER_1Y (= 0.7, 70%)
  branch === "under2y" → SHORT_TERM_RATE_UNDER_2Y (= 0.6, 60%)
  branch === "over2y"  → tax_rules.findBracket(taxBase) 호출 → { marginalRate, baseTax, lowerBound, ... }
```

v0.1.1 §3-9 그대로. 변경 없음.

### 4-10. 단계 10 — `computeCalculatedTax(taxBase, appliedRate)` (v0.1.1 그대로)

```
산식:
  단기세율 (number 단일):
    calculatedTax = Math.floor(taxBase × appliedRate)
  누진세율 (구간 객체):
    calculatedTax = Math.floor(bracket.baseTax + (taxBase − bracket.lowerBound) × bracket.marginalRate)
```

v0.1.1 §3-10 그대로. 변경 없음. **`Math.floor` 절사 1회**.

### 4-11. 단계 11 — `computeLocalIncomeTax(calculatedTax)` (v0.1.1 그대로)

```
산식: localIncomeTax = Math.floor(calculatedTax × LOCAL_INCOME_TAX_RATE) (= calculatedTax × 0.1)
```

v0.1.1 §3-11 그대로. 변경 없음. **`Math.floor` 절사 1회**.

### 4-12. 단계 12 — `computeTotalTax(calculatedTax, localIncomeTax)` (v0.1.1 그대로)

```
산식: totalTax = calculatedTax + localIncomeTax
```

v0.1.1 §3-12 그대로. 변경 없음.

### 4-13. 단계 13 — `computeNetAfterTaxSaleAmount(salePrice, totalTax)` + 결과 객체 반환 (v0.1.1 그대로 + v0.2 보강)

```
산식: netAfterTaxSaleAmount = salePrice − totalTax

결과 객체 반환 (모듈 스펙 §4-1·§4-2):
result = {
  engineVersion:    "v0.2.0",                      // 갱신
  ruleVersion:      tax_rules.RULE_VERSION,        // = "v0.2.0-post-20260510"
  lawRefs:          tax_rules.LAW_REFS,            // 10키 (v0.1 6 + v0.2 신규 4)
  caseDataSnapshot: deepClone(caseData),           // 입력 캡처
  steps: {
    // ─── v0.1 13개 필드 (이름·타입 유지) ───
    transferGain, taxableGain, nonTaxableGain,
    longTermDeduction, capitalGainIncome,
    basicDeduction, taxBase,
    holdingPeriodBranch, appliedRate,
    calculatedTax, localIncomeTax,
    
    // ─── v0.2 신규 10개 필드 (모듈 스펙 §4-2) ───
    is1Se1House,                  // boolean
    isHighValueHouse,             // boolean
    allocationRatio,              // number (1.0 또는 안분비율)
    appliedDeductionTable,        // 1 | 2 | null
    holdingYears,                 // number
    residenceYears,               // number
    holdingRate,                  // number
    residenceRate,                // number
    totalRate,                    // number
    terminateAt2                  // boolean
  },
  totalTax,
  netAfterTaxSaleAmount,
  effectiveTaxRate: computeEffectiveTaxRate(totalTax, salePrice),
  issueFlags:       collectIssueFlags(caseData, intermediates),
  timestamp:        new Date().toISOString()       // 비결정성 항목
}
```

#### 4-13-1. terminateAt2 = true 시 후속 단계 값 일관성 (모듈 스펙 §4-2-1)

명세서 §2 단계 2 종료 시 (12억 이하 비과세), 후속 단계의 `result.steps` 값은 **명시적 0 또는 null**로 채운다 (결과 객체 일관성 약속).

| 필드 | terminateAt2=true 시 값 |
|---|---|
| `taxableGain` | 0 |
| `longTermDeduction` | 0 |
| `capitalGainIncome` | 0 |
| `basicDeduction` | 0 |
| `taxBase` | 0 |
| `holdingPeriodBranch` | 산출 후 그대로 기록 (정보 보존) |
| `appliedRate` | null |
| `calculatedTax` | 0 |
| `localIncomeTax` | 0 |
| `appliedDeductionTable` | null |
| `holdingRate` | 0 |
| `residenceRate` | 0 |
| `totalRate` | 0 |
| `nonTaxableGain` | transferGain (전액 비과세) |
| `allocationRatio` | 1.0 |
| `result.totalTax` | 0 |
| `result.netAfterTaxSaleAmount` | salePrice |
| `result.effectiveTaxRate` | 0 |

> 호출 측이 `result.steps.calculatedTax === 0` 같은 단순 비교로 안전하게 분기할 수 있도록 보장하기 위함. **`undefined` 누락 금지**.


---

## 5. issueFlag 카탈로그 (v0.1 10종 → v0.2 18종)

### 5-1. v0.1 issueFlag 그대로 유지 (5종)

| code | 발동 조건 | severity | lawRef |
|---|---|---|---|
| `OUT_OF_V01_SCOPE_DATE` | `saleDate < APPLICABLE_SALE_DATE_FROM` ("2026-05-10") | warning | 소득세법 부칙 |
| `NECESSARY_EXPENSE_BREAKDOWN_MISSING` | 항상 | info | 소득세법 제97조 |
| `ACQUISITION_CAUSE_ASSUMED_PURCHASE` | 항상 | info | (가정) |
| `HOLDING_PERIOD_BOUNDARY` | 1년·2년·**3년·15년** 마크의 ±3일 (v0.2 확장) | info | 시행령 제155조 단서, 제95조 ② |
| `TRANSFER_LOSS_DETECTED` | `transferGain < 0` | info | 소득세법 제95조 ① |

### 5-2. v0.1 issueFlag 변경 (5종)

| code | v0.1 동작 | v0.2 동작 (명세서 §6-2) |
|---|---|---|
| `LONG_TERM_DEDUCTION_NOT_APPLIED` | 보유 ≥ 3년 시 항상 발동 | **폐기**. `LONG_TERM_DEDUCTION_TABLE_1`/`_TABLE_2`로 대체. 보유 < 3년 미적용은 issueFlag 없음 |
| `POSSIBLE_NON_TAXATION_1H1H` | 보유 ≥ 2년 + 거주 ≥ 24M + candidateHouseCount === 1 | **발동조건 변경**: `is1Se1House === false && householdHouseCount === 1 && holdingYears >= 2 && residenceMonths >= 24` (비과세 적용 안 됐지만 잠재 가능 케이스). 비과세 적용된 경우 `IS_1SE_1HOUSE` 발동으로 중복 회피 |
| `HIGH_VALUE_HOUSE` | salePrice ≥ 12억 시 항상 발동 | **발동조건 변경**: `is1Se1House === false && salePrice >= 1,200,000,000`. 비과세 + 12억 초과는 `IS_HIGH_VALUE_HOUSE`로 대체 |
| `OUT_OF_V01_SCOPE_REGULATED_AREA` | 취득·양도 어느 한쪽이라도 조정대상지역 | **발동조건 축소**: `saleRegulated === true`만 (취득시 조정대상지역은 v0.2 거주요건 정상 활용이므로 미발동). v0.3에서 `OUT_OF_V0X_SCOPE_REGULATED_AREA_AT_SALE`로 개명 검토 |
| `UNREGISTERED_ASSET_ASSUMED_FALSE` | 항상 | **이름 변경 권고**: `UNREGISTERED_RATE_NOT_APPLIED`로 변경 (모듈 스펙 §11-5 결정 — Claude Code 재량). 발동 조건 동일 (항상). v0.1 회귀 시 issueFlag 검증 케이스가 있으면 함께 갱신 |

> **`UNREGISTERED_ASSET_ASSUMED_FALSE` → `UNREGISTERED_RATE_NOT_APPLIED` 이름 변경 결정 (모듈 스펙 §11-5)**: 본 작업지시서는 **새 이름 채택 권고**. 이유: v0.2 issueFlag 카탈로그 명세서 §6-2가 새 이름을 명시. v0.1 회귀에 issueFlag code 문자열 비교가 있다면 §2-3 단서 (b)에 따라 함께 갱신. 결정이 어렵다면 v0.1 이름 그대로 유지 가능 (보수 옵션).

### 5-3. v0.2 신규 issueFlag (5종, 명세서 §6-1)

| code | 발동 조건 | severity | lawRef | message 예시 |
|---|---|---|---|---|
| `IS_1SE_1HOUSE` | `is1Se1House === true` (단계 2 결과) | info | 소득세법 제89조 ①ⅲ, 시행령 제154조 | "1세대1주택 비과세가 적용되었습니다 (보유 N년, 거주 N년)." |
| `IS_HIGH_VALUE_HOUSE` | `is1Se1House && salePrice >= 1,200,000,000` | info | 제95조 ③, 시행령 제160조 | "양도가액 12억원 초과분에 안분 과세가 적용되었습니다 (안분비율 NN.NN%)." |
| `LONG_TERM_DEDUCTION_TABLE_1` | `appliedDeductionTable === 1` | info | 제95조 ② 표 1 | "장기보유특별공제 표 1 적용 (보유 N년 → NN%)." |
| `LONG_TERM_DEDUCTION_TABLE_2` | `appliedDeductionTable === 2` | info | 제95조 ② 표 2 | "장기보유특별공제 표 2 적용 (보유 NN% + 거주 NN% = 합계 NN%)." |
| `ONE_TIME_2HOUSES_NOT_APPLIED` | `caseData.isOneTimeTwoHouses === true` | warning | 시행령 제155조 ① | "일시적 2주택 특례는 v0.2에서 미적용. 다주택 일반과세로 처리됩니다. v0.3에서 정확한 산정 예정입니다." |

### 5-4. v0.2 보조 issueFlag (3종, 명세서 §6-4)

| code | 발동 조건 | severity | 목적 |
|---|---|---|---|
| `RESIDENCE_MONTHS_USER_INPUT` | 항상 | info | 거주기간 산정은 사용자 책임 명시 (시행령 제154조 ⑥) |
| `RESIDENCE_EXEMPTION_NOT_HANDLED` | `acquisitionRegulated && residenceMonths < 24` | info | 거주요건 면제 사유(공익사업 수용 등 시행령 제154조 ① 단서) v0.2 미처리 |
| `LONG_TERM_DEDUCTION_HOLDING_LESS_THAN_3Y_FOR_TABLE_2` | `is1Se1House && isHighValueHouse && holdingYears < 3` | info | 1세대1주택 12억 초과지만 보유 3년 미만이라 표 2 미적용 |

### 5-5. issueFlag 합계 (모듈 스펙 §6-6)

```
v0.1: 10종 (유지 5 + 변경 5)
v0.2: 5(유지) + 5(변경, UNREGISTERED 이름 변경 + LONG_TERM_DEDUCTION_NOT_APPLIED 폐기 1) + 5(신규) + 3(보조) = 활성 18종
```

> 폐기 1종(`LONG_TERM_DEDUCTION_NOT_APPLIED`)은 v0.2에서 발동하지 않음. v0.1 회귀 테스트가 본 issueFlag를 발동 검증하고 있다면 §2-3 단서 (b)에 따라 v0.2 회귀 테스트에서 별도 처리 (예: v0.1 골든셋은 자동 보정으로 다주택 처리되므로 본 issueFlag 발동 없음 확인 + v0.2 신규 케이스에서는 폐기 확인).

### 5-6. `intermediates` 입력 보강 (모듈 스펙 §6-2-1)

`collectIssueFlags(caseData, intermediates)`의 `intermediates` 입력에 v0.2 신규 필드 5종 추가:

| 필드 | 출처 | 용도 |
|---|---|---|
| `is1Se1House` | 단계 2 | `IS_1SE_1HOUSE`·`POSSIBLE_NON_TAXATION_1H1H`·`HIGH_VALUE_HOUSE`·`IS_HIGH_VALUE_HOUSE` 분기 |
| `isHighValueHouse` | 단계 2/3 | `IS_HIGH_VALUE_HOUSE` 발동 |
| `terminateAt2` | 단계 2 | 발동 분기 보조 (전액 비과세 케이스 식별) |
| `appliedDeductionTable` | 단계 4 | `LONG_TERM_DEDUCTION_TABLE_1`·`_TABLE_2` 발동 |
| `holdingYears`·`residenceYears` | 단계 2 | `LONG_TERM_DEDUCTION_HOLDING_LESS_THAN_3Y_FOR_TABLE_2`·`HOLDING_PERIOD_BOUNDARY`(2/3/15년 마크 ±3일) |

---

## 6. 호출 측 모듈 정합성 (인계 1·3 적용)

### 6-1. tax_rules.js v0.2 24종 노출 멤버 호출 패턴

본 모듈은 `tax_rules.js` v0.2.0의 24종 노출 멤버 중 **15종을 read-only로 사용**한다 (모듈 스펙 §8-1 표).

| 사용 단계 | 사용 멤버 | 호출 패턴 |
|---|---|---|
| 부트스트랩 | `tax_rules.RULE_VERSION` | 결과 객체 메타 기록 |
| 부트스트랩 | `tax_rules.LAW_REFS` | 결과 객체 메타 기록 |
| 부트스트랩 | `tax_rules.selfTest()` | `ok === true` 확인 후 진행 |
| 단계 0 | `tax_rules.APPLICABLE_SALE_DATE_FROM` | 양도일 하한 비교 |
| **단계 2** | **`tax_rules.HIGH_VALUE_HOUSE_THRESHOLD`** | `salePrice <= HIGH_VALUE_HOUSE_THRESHOLD` 비교 |
| **단계 2** | **`tax_rules.NON_TAXABLE_HOLDING_MIN_YEARS`** | 보유연수 비교 (정수 연차) |
| **단계 2** | **`tax_rules.NON_TAXABLE_RESIDENCE_MIN_YEARS`** | 거주개월 비교 (`* 12` 호출 측 변환) |
| **단계 3** | **`tax_rules.HIGH_VALUE_HOUSE_THRESHOLD`** | 안분 산식 분모 |
| **단계 4** | **`tax_rules.LONG_TERM_DEDUCTION_TABLE_1`** | `findHoldingRate` 인자로 전달 |
| **단계 4** | **`tax_rules.LONG_TERM_DEDUCTION_TABLE_2_HOLDING`** | `findHoldingRate` 인자로 전달 |
| **단계 4** | **`tax_rules.LONG_TERM_DEDUCTION_TABLE_2_RESIDENCE`** | `findResidenceRate` 인자로 전달 |
| **단계 4** | **`tax_rules.findHoldingRate(holdingYears, table)`** | 표 1·표 2 좌측 공통 룩업 |
| **단계 4** | **`tax_rules.findResidenceRate(residenceYears, holdingYears, table)`** | 표 2 우측 룩업 (단서 단속) |
| 단계 6 | `tax_rules.BASIC_DEDUCTION_AMOUNT` | 기본공제 250만원 |
| 단계 9 | `tax_rules.SHORT_TERM_RATE_UNDER_1Y`, `tax_rules.SHORT_TERM_RATE_UNDER_2Y` | 단기세율 70%·60% |
| 단계 9 | `tax_rules.PROGRESSIVE_BRACKETS`, `tax_rules.findBracket(taxBase)` | 누진세율 룩업 |
| 단계 11 | `tax_rules.LOCAL_INCOME_TAX_RATE` | 지방소득세 10% |
| issueFlag | `tax_rules.HOLDING_PERIOD_BOUNDARY_YEARS` (= `[1, 2, 3, 15]`) | `HOLDING_PERIOD_BOUNDARY` 마크 비교 |
| issueFlag | `tax_rules.LAW_REFS` | issueFlag lawRef 매핑 |
| issueFlag | `tax_rules.UNREGISTERED_RATE` (= 0.7) | `UNREGISTERED_RATE_NOT_APPLIED` 메시지 정보 |

> **사용하지 않는 9종**: v0.1 17종 + v0.2 7종 = 24종 중 본 모듈이 호출하지 않는 9종(예: `verifyProgressiveContinuity`·`verifyBaseTaxAreIntegers`·`verifyMonotonic`·`verifyLongTermLookups` — `selfTest` 내부에서만 사용). 본 모듈은 `selfTest().ok`만 확인.

### 6-2. 임계 명칭 (정본 채택, 별칭 사용 금지 — 인계 1)

본 모듈은 `tax_rules.js`의 정본 명칭을 그대로 사용한다.

| 정본 명칭 (사용) | 정본 의미 | 별칭 (사용 금지) |
|---|---|---|
| `tax_rules.NON_TAXABLE_HOLDING_MIN_YEARS` (= 2, 년 단위) | 비과세 보유 임계 (전국 공통) | ~~`EXEMPTION_HOLDING_THRESHOLD_YEARS`~~ (tax_engine.md v0.2.1 §8-1 별칭, 사용 금지) |
| `tax_rules.NON_TAXABLE_RESIDENCE_MIN_YEARS` (= 2, 년 단위) | 비과세 거주 임계 (조정대상지역 한정) | ~~`EXEMPTION_RESIDENCE_THRESHOLD_MONTHS`~~ (tax_engine.md v0.2.1 §8-1 별칭, **단위가 다름**, 사용 금지) |
| `tax_rules.HIGH_VALUE_HOUSE_THRESHOLD` (= 1,200,000,000, 원 단위) | 12억 임계 | (별칭 없음) |

> **인계 1 정본 채택 근거**: tax_rules.js v0.2.0 코드 + tax_rules.md v0.2.0 §3-5 + 작업지시서 03 §3-2 모두 정본 명칭 사용 중. tax_engine.md v0.2.1 §8-1 별칭은 모듈 스펙 v0.2.0 §3-5 결정과 충돌하므로 본 작업지시서는 정본을 채택한다. **단위 일관성**: 정본은 모두 `_MIN_YEARS` (년 단위). 거주 비교 시 `residenceMonths >= NON_TAXABLE_RESIDENCE_MIN_YEARS * 12` 형태로 호출 측에서 단위 변환 (작업지시서 03 §5-3 인용).

> **인계 4 — 모듈 스펙 정정 권고**: tax_engine.md v0.2.1 §8-1 별칭(`EXEMPTION_HOLDING_THRESHOLD_YEARS`·`EXEMPTION_RESIDENCE_THRESHOLD_MONTHS`)은 모듈 스펙 정정 필요. 본 작업지시서는 별칭 사용 금지로 처리하나, 모듈 스펙 차후 정정은 백로그 등록 권고 (B-024 또는 신규 ID, 본 관제탑 책임).

### 6-3. 룩업 함수 호출 패턴

```
[단계 4 — 표 1·표 2 룩업]

표 1 적용 시:
  holdingRate = tax_rules.findHoldingRate(
    holdingYears,
    tax_rules.LONG_TERM_DEDUCTION_TABLE_1
  );
  // 클램프 내부 처리: < 3년 → 0, ≥ 15년 → 0.30

표 2 적용 시:
  holdingRate = tax_rules.findHoldingRate(
    holdingYears,
    tax_rules.LONG_TERM_DEDUCTION_TABLE_2_HOLDING
  );
  // 클램프 내부 처리: < 3년 → 0, ≥ 10년 → 0.40
  
  residenceRate = tax_rules.findResidenceRate(
    residenceYears,
    holdingYears,        // 단서 단속용
    tax_rules.LONG_TERM_DEDUCTION_TABLE_2_RESIDENCE
  );
  // 클램프·단서 내부 처리:
  //   holdingYears < 3 → 0 (단서 차단)
  //   residenceYears < 2 → 0
  //   2 ≤ residenceYears < 3 → 0.08 (단서 행 활성)
  //   residenceYears ≥ 10 → 0.40

[단계 9 — 누진세율 룩업, v0.1 그대로]

bracket = tax_rules.findBracket(taxBase);
// 반환 객체: { idx, marginalRate, baseTax, lowerBound, upperBound, label }
```

> **호출 측 클램프 미적용 원칙 (의사결정 #5 강화 §0-1 원칙 (3))**: `tax_engine.js`는 룩업 함수 결과에 대해 **별도 클램프를 적용하지 않는다**. 클램프는 룩업 함수 내부에서 처리되므로 호출 측이 다시 적용하면 이중 처리 위험. 결과를 그대로 사용한다.

### 6-4. 부트스트랩 가드 (v0.1 + v0.2 추가)

```js
// v0.1 가드 (그대로)
if (!window.TaxOpt || !window.TaxOpt.taxRules) {
  throw new Error('tax_engine: tax_rules.js가 먼저 로드되어야 합니다.');
}

// v0.2 추가 가드 (모듈 스펙 §8-2-1)
if (typeof window.TaxOpt.taxRules.HIGH_VALUE_HOUSE_THRESHOLD === 'undefined') {
  throw new Error('tax_engine v0.2: tax_rules v0.2 (장특공 표·12억 임계 등) 미로드.');
}

// selfTest 통과 확인 (모듈 스펙 §8-3)
var st = window.TaxOpt.taxRules.selfTest();
if (!st.ok) {
  throw new Error('tax_engine v0.2: tax_rules selfTest failed.');
}

// v0.2 신규 룩업 함수 노출 확인 (모듈 스펙 §8-3)
if (typeof window.TaxOpt.taxRules.findHoldingRate !== 'function' ||
    typeof window.TaxOpt.taxRules.findResidenceRate !== 'function' ||
    !Array.isArray(window.TaxOpt.taxRules.LONG_TERM_DEDUCTION_TABLE_1)) {
  throw new Error('tax_engine v0.2: tax_rules v0.2 룩업 함수·테이블 미로드.');
}
```

> 본 가드는 `calculateSingleTransfer`의 진입부 또는 모듈 IIFE 종료 직후에서 1회 실행. v0.1 코드의 가드 패턴과 일관되게 작성.

### 6-5. v0.1 호환성 보장

본 모듈은 v0.1 호출 측이 `houses[0]` 단일 케이스만 사용하던 동작을 그대로 보존한다. v0.2에서도 `salePlan.candidateHouseIds.length === 1` (단일 양도, 다주택 보유 가능)로 한정. 다주택 시나리오 엔진은 v0.3에서 도입 (의사결정 #10 적용).


---

## 7. 절사 처리

### 7-1. v0.1 절사 위치 (단계 10·11) 그대로

| 단계 | 변수 | 절사 |
|---|---|---|
| 10 | `calculatedTax` | `Math.floor(taxBase × appliedRate)` 또는 `Math.floor(baseTax + (taxBase − lowerBound) × marginalRate)` |
| 11 | `localIncomeTax` | `Math.floor(calculatedTax × 0.1)` |

v0.1.1 §5 그대로. 변경 없음.

### 7-2. v0.2 신규 절사 위치 (단계 3 + 단계 4)

본 작업지시서가 인계받은 시스템 프롬프트의 "Math.floor 두 번 절사 (안분 후 + 장특공 적용 후)"는 다음 위치를 의미한다.

| 단계 | 변수 | 절사 |
|---|---|---|
| **3** | **`taxableGain` (안분 후)** | **`Math.floor(transferGain × allocationRatio)` 1회** (안분 진입 시만) |
| **4** | **`longTermDeduction`** | **`Math.floor(taxableGain × totalRate)` 1회** |

> **장특공 동시 안분 폐기 (수학적 동치 — 명세서 §4-3)**: 시행령 제160조 ①의 안분 산식은 양도차익·장특공 양쪽에 안분비율을 곱하지만, 본 모듈은 단계 3에서 1회 안분 후 단계 4에서 (안분 후 양도차익 × 공제율) 1회 곱셈으로 처리한다. 수학적 동치이며 절사는 단계 3·단계 4 각 1회씩 총 2회 (단계 10·11 합산하여 v0.2 전체 4회 절사).

### 7-3. 절사 정책 일람

| 절사 위치 | 산식 | 비고 |
|---|---|---|
| 단계 3 (`calculateHighValuePortion`) | `taxableGain = Math.floor(transferGain × allocationRatio)` | 안분 진입 시만. allocationRatio는 절사하지 않음 (비율) |
| 단계 4 (`calculateLongTermDeduction`) | `longTermDeduction = Math.floor(taxableGain × totalRate)` | 표 1·표 2 모두 동일. holdingRate·residenceRate·totalRate는 절사하지 않음 (비율) |
| 단계 10 (`computeCalculatedTax`) | `calculatedTax = Math.floor(...)` | 단기/누진 모두 |
| 단계 11 (`computeLocalIncomeTax`) | `localIncomeTax = Math.floor(calculatedTax × 0.1)` | |

> **거주연수 절사**: `residenceYears = Math.floor(residenceMonths / 12)` (단계 2에서 산출). 절사 처리이지만 연수 정수화로 분류.

> **`B-022` 정수 처리 (절사 vs 반올림)**: TC-009에서 발생한 1원 차이(검증팀·Claude 77,142,856 vs 홈택스 77,142,857)는 본 작업에서 정정하지 않는다. `Math.floor` 두 번 절사 그대로 유지 (국세 기본 처리 원칙 부합). 향후 모의계산상 반올림 처리가 정당한 계산방법으로 확인되는 경우 산식 정정 (백로그 B-022).

---

## 8. 입력 검증 (validateCaseData v0.2)

§4-0에서 산식·자동 보정 룰을 다뤘다. 본 절은 검증 항목 매트릭스만 정리한다.

### 8-1. v0.1 검증 항목 (그대로)

| # | 검증 항목 | 실패 처리 |
|---|---|---|
| 1 | `salePrice`: `Number.isInteger && >= 1` | 에러 |
| 2 | `acquisitionPrice`: `Number.isInteger && >= 1` | 에러 |
| 3 | `necessaryExpense`: `Number.isInteger && >= 0` | 에러 |
| 4 | `acquisitionDate`: `"YYYY-MM-DD"` 패턴 유효 | 에러 |
| 5 | `saleDate`: `"YYYY-MM-DD"` 패턴 유효 | 에러 |
| 6 | `acquisitionDate < saleDate` | 에러 |
| 7 | `saleDate.year === baseYear` | 경고 |
| 8 | `saleDate >= APPLICABLE_SALE_DATE_FROM` ("2026-05-10") | 경고 |

### 8-2. v0.2 신규 검증 항목 (5종, 명세서 §7-2)

| # | 검증 항목 | 실패 처리 |
|---|---|---|
| 9 | `householdHouseCount`: `Number.isInteger && >= 1` | 누락 시 자동 보정 (§8-3). 음수·0 시 에러 |
| 10 | `residenceMonths`: `Number.isInteger && >= 0` | 누락 시 0 자동 보정. 음수 시 에러 |
| 11 | `livingNow`: `boolean` | 누락 시 false 자동 보정 |
| 12 | `isOneTimeTwoHouses`: `boolean` | 누락 시 false 자동 보정 |
| 13 | `acquisitionRegulated`: `boolean` | 누락 시 false 자동 보정 (v0.1 호환) |

### 8-3. 자동 보정 룰 (B-019 — 명세서 §7-3)

§4-0-1 표 그대로. 입력 변경 금지 원칙(`caseData` 깊은 복사 후 보정).

---

## 9. 결과 객체 구조 (taxResult)

### 9-1. 결과 객체 톱레벨 (v0.1 동일, 모듈 스펙 §4-1)

```js
result = {
  engineVersion:    "v0.2.0",                    // 갱신
  ruleVersion:      tax_rules.RULE_VERSION,      // = "v0.2.0-post-20260510"
  lawRefs:          tax_rules.LAW_REFS,          // 10키
  caseDataSnapshot: object,                      // 입력 캡처 (불변성 검증용)
  steps:            object,                      // §9-2
  totalTax:         number,                      // 최종 양도소득세 + 지방소득세
  netAfterTaxSaleAmount: number,                 // salePrice − totalTax
  effectiveTaxRate: number | null,               // totalTax / salePrice (B-008 metrics)
  issueFlags:       IssueFlag[],                 // 18종 카탈로그
  timestamp:        string                       // ISO 8601 (비결정성)
}
```

### 9-2. `result.steps` 구조 (모듈 스펙 §4-2)

#### 9-2-1. v0.1 13개 필드 (이름·타입 유지)

| 필드 | 타입 | 의미 |
|---|---|---|
| `transferGain` | number | 1단계 양도차익 |
| `taxableGain` | number | 3단계 후 과세대상 양도차익 (안분 적용 시 안분 후 값) |
| `nonTaxableGain` | number | 비과세분 (= transferGain − taxableGain) |
| `longTermDeduction` | number | 4단계 장특공 |
| `capitalGainIncome` | number | 5단계 양도소득금액 |
| `basicDeduction` | number | 6단계 기본공제 |
| `taxBase` | number | 7단계 과세표준 |
| `holdingPeriodBranch` | string | 8단계 분기 (`under1y`·`under2y`·`over2y`) |
| `appliedRate` | number \| object | 9단계 적용 세율(단기) 또는 누진 구간 객체 |
| `calculatedTax` | number | 10단계 산출세액 |
| `localIncomeTax` | number | 11단계 지방소득세 |

> 12·13단계 산출값(`totalTax`·`netAfterTaxSaleAmount`)은 톱레벨로 노출 (steps 내부 미노출, v0.1.1 그대로).

#### 9-2-2. v0.2 신규 10개 필드 (모듈 스펙 §4-2)

| 필드 | 타입 | 의미 |
|---|---|---|
| `is1Se1House` | boolean | 1세대1주택 비과세 적용 여부 |
| `isHighValueHouse` | boolean | 12억 초과 → 안분 진입 여부 |
| `allocationRatio` | number | 안분비율. 비과세 미적용·12억 이하 비과세 시 `1.0`. 안분 진입 시 `(salePrice − 12억) / salePrice` |
| `appliedDeductionTable` | `1` \| `2` \| `null` | 적용 장특공 표. 보유<3년 또는 비과세 종료 시 `null` |
| `holdingYears` | number | 보유 정수 연차. 표 1·2 산출 입력 |
| `residenceYears` | number | 거주 정수 연차. 표 2 거주공제율 산출 입력 |
| `holdingRate` | number | 보유공제율 (표 1·2 공통). 표 1: 6~30%, 표 2: 12~40% |
| `residenceRate` | number | 거주공제율 (표 2 한정). 표 1 적용 시 0 |
| `totalRate` | number | 적용 공제율 합계 (longTermDeduction = floor(taxableGain × totalRate)) |
| `terminateAt2` | boolean | 단계 2에서 파이프라인 종료 여부 (12억 이하 비과세 시 true) |

### 9-3. terminateAt2 시 후속 단계 0/null 정책

§4-13-1 표 그대로 (모듈 스펙 §4-2-1). `undefined` 누락 금지.

---

## 10. tests/tax_engine.test.js v0.2 변경

### 10-1. v0.1 회귀 테스트 234건 그대로 보존 + strict-eq 1라인 예외

§2-3 단서 적용. v0.1 회귀 234건 중 `RULE_VERSION` strict-eq 비교 라인 1줄은 5/1 commit 8612cad에서 이미 갱신됨 (`"v0.2.0-post-20260510"`). 본 작업에서 추가 갱신 불필요.

`ENGINE_VERSION` strict-eq 비교 라인이 v0.1 회귀에 있다면 §2-3 예외 (c)에 따라 갱신 가능 (`"v0.1.1"` → `"v0.2.0"`).

### 10-2. v0.2 신규 회귀 테스트 그룹 (Claude Code 결정)

다음 그룹은 모듈 스펙 §6-1·§12 + 명세서 §9 검증 항목을 기반으로 한다. 정확한 케이스 수는 Claude Code 재량이지만, 다음 항목을 빠짐없이 포함해야 한다.

#### 10-2-1. 그룹 A — selfTest 부트스트랩 보강 검증

```
test('selfTest().ok === true');
test('selfTest().taxRulesSelfTest.ok === true (호출 측 모듈 검증 통과)');
test('selfTest().sanityChecks.ok === true (TC-001/003/005 + TC-006/008/010 권장)');
test('부트스트랩 가드 — tax_rules.HIGH_VALUE_HOUSE_THRESHOLD 미로드 시 throw');
test('부트스트랩 가드 — tax_rules.findHoldingRate 미로드 시 throw');
```

#### 10-2-2. 그룹 B — validateCaseData v0.2 (자동 보정 + 신규 검증)

```
test('validateCaseData: householdHouseCount 누락 → salePlan.candidateHouseIds.length로 보정');
test('validateCaseData: householdHouseCount === 0 → 에러');
test('validateCaseData: residenceMonths 누락 → 0 보정 + RESIDENCE_MONTHS_DEFAULTED_ZERO');
test('validateCaseData: residenceMonths < 0 → 에러');
test('validateCaseData: livingNow 누락 → false 보정');
test('validateCaseData: isOneTimeTwoHouses 누락 → false 보정');
test('validateCaseData: acquisitionRegulated 누락 → false 보정 (v0.1 호환)');
test('validateCaseData: 입력 객체 변경 없음 (deep equal 검증)');
```

#### 10-2-3. 그룹 C — 13단계 파이프라인 TC-006~010 골든셋 (5건 × 13~23개 항목)

각 TC당 다음을 모두 검증:

```
test('TC-XXX: transferGain === <기대값>');
test('TC-XXX: is1Se1House === <기대값>');
test('TC-XXX: isHighValueHouse === <기대값>');
test('TC-XXX: allocationRatio === <기대값>');
test('TC-XXX: terminateAt2 === <기대값>');
test('TC-XXX: taxableGain === <기대값>');
test('TC-XXX: appliedDeductionTable === <기대값>');
test('TC-XXX: holdingYears === <기대값>');
test('TC-XXX: residenceYears === <기대값>');
test('TC-XXX: holdingRate === <기대값>');
test('TC-XXX: residenceRate === <기대값>');
test('TC-XXX: totalRate === <기대값>');
test('TC-XXX: longTermDeduction === <기대값>');
test('TC-XXX: capitalGainIncome === <기대값>');
test('TC-XXX: basicDeduction === <기대값>');
test('TC-XXX: taxBase === <기대값>');
test('TC-XXX: holdingPeriodBranch === <기대값>');
test('TC-XXX: appliedRate === <기대값>');
test('TC-XXX: calculatedTax === <기대값>');
test('TC-XXX: localIncomeTax === <기대값>');
test('TC-XXX: totalTax === <기대값>');           ← 최우선 검증
test('TC-XXX: netAfterTaxSaleAmount === <기대값>');
test('TC-XXX: effectiveTaxRate === <기대값>');
```

기대값은 `docs/v0.2/06_test_cases.md` v0.2.1 + `docs/v0.2/04_test_cases_manual.xlsx` 8 시트에서 읽어 하드코딩 상수로 둔다.

#### 10-2-4. 그룹 D — TC-001~005 v0.1 회귀 (입력 패치 적용 후)

명세서 v0.2.1 §9-1에 따라 v0.1 골든셋 입력에 `householdHouseCount: 2` 추가 후 v0.1 정답값(예: TC-001 totalTax 98,241,000) 그대로 통과 검증.

```
test('TC-001 (v0.1 회귀, householdHouseCount: 2 패치): totalTax === 98,241,000');
test('TC-002 (v0.1 회귀): ...');
// ... TC-003·TC-004·TC-005 동일
```

> 본 회귀는 **v0.1 회귀 테스트 234건과 별도**로 v0.2 신규 그룹에 추가. v0.1 회귀 234건 중 골든셋 검증 케이스는 패치 미적용 입력으로 작성됐을 가능성이 있으므로, 자동 보정 룰이 `salePlan.candidateHouseIds.length`로 추정하여 v0.1 결과와 동일하게 산출하는지 검증. 명세서 §9-1의 수동 패치 권고 외에도 자동 보정만으로 회귀 통과 가능성 검증.

#### 10-2-5. 그룹 E — 단계 2·3·4 단위 함수 회귀

```
[check1Se1HouseExemption 단위]
test('check1Se1HouseExemption: 다주택(householdHouseCount=2) → is1Se1House=false, reason=MULTI_HOUSE');
test('check1Se1HouseExemption: 보유 1년 → is1Se1House=false, reason=HOLDING_LT_2Y');
test('check1Se1HouseExemption: 조정대상지역 + 거주 12개월 → is1Se1House=false, reason=RESIDENCE_LT_24M_REGULATED');
test('check1Se1HouseExemption: 비조정대상 + 보유 5년 + 12억 이하 → terminateAt2=true');
test('check1Se1HouseExemption: 비조정대상 + 보유 5년 + 12억 초과 → terminateAt2=false, isHighValueHouse=true');
test('check1Se1HouseExemption: 조정대상지역 + 거주 24개월 + 보유 5년 → is1Se1House=true');

[calculateHighValuePortion 단위]
test('calculateHighValuePortion: 양도가액 12억 이하 입력 시 throw');
test('calculateHighValuePortion: 양도가액 14억 → allocationRatio = 1/7 ≈ 0.1428...');
test('calculateHighValuePortion: 양도가액 15억 → allocationRatio = 0.20');
test('calculateHighValuePortion: 안분 후 taxableGain 정수 (Math.floor)');

[calculateLongTermDeduction 단위]
test('calculateLongTermDeduction: 다주택 + 보유 12년 → 표 1, totalRate = 0.24');
test('calculateLongTermDeduction: 1세대1주택 + 12억 초과 + 보유 8년 + 거주 8년 → 표 2, totalRate = 0.64');
test('calculateLongTermDeduction: 1세대1주택 + 12억 초과 + 보유 10년 + 거주 10년 → 표 2, totalRate = 0.80 (최대)');
test('calculateLongTermDeduction: 다주택 + 보유 5년 → 표 1, totalRate = 0.10 (TC-010)');
test('calculateLongTermDeduction: 1세대1주택 + 12억 초과 + 보유 2년 → appliedDeductionTable=null, totalRate=0');
test('calculateLongTermDeduction: longTermDeduction 정수 (Math.floor)');
```

#### 10-2-6. 그룹 F — issueFlag 카탈로그 18종 발동 검증

각 issueFlag별로 발동 케이스 1건 + 미발동 케이스 1건씩.

```
test('IS_1SE_1HOUSE 발동 — TC-006~009');
test('IS_HIGH_VALUE_HOUSE 발동 — TC-007/009 (안분 진입)');
test('LONG_TERM_DEDUCTION_TABLE_1 발동 — TC-008/010');
test('LONG_TERM_DEDUCTION_TABLE_2 발동 — TC-007/009');
test('ONE_TIME_2HOUSES_NOT_APPLIED 발동 — TC-010 (warning)');
test('RESIDENCE_MONTHS_USER_INPUT 발동 — 모든 케이스 (info)');
test('LONG_TERM_DEDUCTION_NOT_APPLIED 미발동 (v0.2 폐기)');
// ... 18종 모두 검증
```

#### 10-2-7. 그룹 G — terminateAt2 후속 단계 0/null 정책

```
test('TC-006 (terminateAt2=true): result.steps.taxableGain === 0');
test('TC-006 (terminateAt2=true): result.steps.longTermDeduction === 0');
test('TC-006 (terminateAt2=true): result.steps.calculatedTax === 0');
test('TC-006 (terminateAt2=true): result.steps.appliedRate === null');
test('TC-006 (terminateAt2=true): result.steps.appliedDeductionTable === null');
test('TC-006 (terminateAt2=true): result.totalTax === 0');
test('TC-006 (terminateAt2=true): result.netAfterTaxSaleAmount === salePrice');
test('TC-006 (terminateAt2=true): result.effectiveTaxRate === 0');
// ... undefined 누락 금지 검증
```

#### 10-2-8. 그룹 H — 정수 산술 보장 (v0.1 그대로 + v0.2 신규)

```
test('result.totalTax는 정수 (Number.isInteger)');
test('result.steps.longTermDeduction은 정수 (v0.2 신규)');
test('result.steps.taxableGain은 정수 (안분 후, v0.2 신규)');
test('result.steps.calculatedTax는 정수');
test('result.steps.localIncomeTax는 정수');
// ... 모든 금액 필드 정수 검증
```

#### 10-2-9. 그룹 I — 순수성 + caseData 변경 금지 (v0.1 그대로 + v0.2 신규)

```
test('calculateSingleTransfer는 caseData를 변경하지 않는다 (deep equal)');
test('validateCaseData는 caseData를 변경하지 않는다 (deep equal, v0.2 신규)');
test('check1Se1HouseExemption은 input을 변경하지 않는다 (v0.2 신규)');
test('calculateHighValuePortion은 input을 변경하지 않는다 (v0.2 신규)');
test('calculateLongTermDeduction은 input을 변경하지 않는다 (v0.2 신규)');
```

#### 10-2-10. 그룹 J — B-008 effectiveTaxRate metrics (v0.1 그대로)

```
test('computeEffectiveTaxRate(0, 0) === null');
test('computeEffectiveTaxRate(98241000, 1000000000) ≈ 0.0982...');
// ... v0.1 회귀 그대로
```

### 10-3. 예상 회귀 테스트 수

본 작업지시서의 §10-2 항목을 모두 포함하면 v0.2 신규 회귀 케이스는 약 80~120건. v0.1 234건 + v0.2 N건 = **약 314~354건** 통과 예상.

```
=== tax_engine v0.2.0 회귀 테스트 ===

[v0.1 회귀 (그대로 보존)]
[1/13] selfTest 부트스트랩 ........................... 3/3 통과 (v0.1 회귀)
[2/13] validateCaseData v0.1 ......................... 9/9 통과 (v0.1 회귀)
[3/13] 13단계 파이프라인 — TC-001~005 골든셋 ......... 5/5 × 13 통과 (v0.1 회귀, 1라인 strict-eq 갱신)
[4/13] 단계별 함수 단위 (v0.1) ....................... XX/XX 통과 (v0.1 회귀)
[5/13] issueFlag 발동 (v0.1) ......................... 10/10 통과 (v0.1 회귀)
[6/13] 정수 산술 보장 (v0.1) ......................... X/X 통과 (v0.1 회귀)
[7/13] 순수성 + B-008 metrics ....................... 7/7 통과 (v0.1 회귀)

[v0.2 신규]
[8/13] selfTest 보강 (TC-006/008/010 sanity) ........ X/X 통과
[9/13] validateCaseData v0.2 (자동 보정 + 신규 검증) ... XX/XX 통과
[10/13] 13단계 — TC-006~010 골든셋 ................... 5/5 × 23 통과
[11/13] TC-001~005 입력 패치 회귀 ..................... 5/5 통과
[12/13] 단계 2·3·4 단위 함수 ......................... XX/XX 통과
[13/13] issueFlag 카탈로그 18종 ....................... 18/18 통과

총 314~354건 통과 / 0건 실패
```

> 그룹 분할·라벨은 Claude Code 재량. v0.1 출력 패턴과 일관되게.


---

## 11. Claude Code 실행 절차

### 11-1. 사전 준비

1. 작업 브랜치 생성 권고 (선택):
   ```
   cd C:\users\ds7st\documents\projects\taxopt
   git checkout -b feat/tax-engine-v0.2
   ```
   > 직접 main에 작업해도 무방 (의사결정 #6 영속화 의무 — git push로 영속). 단 v0.2 코드 검증 실패 시 롤백 부담을 줄이려면 별도 브랜치 권고.

2. 현 v0.1.1 + tax_rules v0.2.0 코드·테스트 상태 확인:
   ```
   node tests/tax_rules.test.js     # 150/0 통과 확인 (v0.2.0 baseline, 5/1 commit 8612cad)
   node tests/tax_engine.test.js    # 234/0 통과 확인 (v0.1.1 baseline, RULE_VERSION 1라인 갱신됨)
   ```

3. 본 작업지시서 + 모듈 스펙 v0.2.1 정독:
   - `docs/05_code_work_orders/04_tax_engine_v0_2.md` (본 문서)
   - `docs/v0.2/modules/tax_engine.md` v0.2.1 (단일 진본)
   - `docs/v0.2/01_calc_engine_spec.md` v0.2.1 (산식 정본)

### 11-2. 코드 작성 (단계별, 한 번에 하나씩 + Node.js 회귀 검증)

다음 순서 권고. 각 단계 후 Node.js 회귀 검증으로 v0.1 234건 보존 확인.

#### 11-2-1. `ENGINE_VERSION` 갱신

   - `js/tax_engine.js`의 `ENGINE_VERSION` 상수 갱신: `"v0.1.1"` → `"v0.2.0"`
   - `node tests/tax_engine.test.js` → 회귀 검증 (`ENGINE_VERSION` strict-eq 비교 라인이 있다면 §2-3 예외 (c)에 따라 갱신)

#### 11-2-2. 부트스트랩 가드 추가 (§6-4)

   - v0.1 가드 그대로 유지
   - v0.2 추가 가드 (`HIGH_VALUE_HOUSE_THRESHOLD`·`findHoldingRate` 노출 확인)
   - `selfTest()` 통과 확인 (`tax_rules.selfTest().ok`)
   - 회귀 검증 (가드만 추가는 v0.1 회귀 영향 없음)

#### 11-2-3. `validateCaseData` v0.2 보강 (§4-0, §8)

   - v0.2 신규 검증 5종 추가
   - 자동 보정 7종 룰 (`HOUSEHOLD_COUNT_INFERRED`·`RESIDENCE_MONTHS_DEFAULTED_ZERO` 등) 추가
   - 입력 변경 금지 원칙 (deep clone 후 보정)
   - 회귀 검증 (v0.1 입력은 자동 보정으로 처리되어 회귀 통과 가능 확인)

#### 11-2-4. `check1Se1HouseExemption` 함수 추가 (§4-2-1)

   - 명세서 §3 결정 트리 그대로 옮김
   - `tax_rules.NON_TAXABLE_HOLDING_MIN_YEARS`·`NON_TAXABLE_RESIDENCE_MIN_YEARS`·`HIGH_VALUE_HOUSE_THRESHOLD` 호출 (정본 명칭, 인계 1)
   - 보유연수 산정은 v0.1.1 §3 동월동일 비교 그대로
   - 거주연수 = `Math.floor(residenceMonths / 12)`
   - 노출 객체에 추가
   - 회귀 검증 (단계 2 활성으로 v0.1 입력의 분기가 변경될 수 있으므로 자동 보정 룰 정합성 확인)

#### 11-2-5. `calculateHighValuePortion` 함수 추가 (§4-3-1)

   - 안분 산식: `allocationRatio = (salePrice − HIGH_VALUE_HOUSE_THRESHOLD) / salePrice`
   - `taxableGain = Math.floor(transferGain × allocationRatio)` (Math.floor 1회)
   - `salePrice <= HIGH_VALUE_HOUSE_THRESHOLD` 입력 시 throw
   - 노출 객체에 추가
   - 회귀 검증

#### 11-2-6. `calculateLongTermDeduction` 함수 추가 (§4-4-1)

   - **표 적용 자격 판정** (`is1Se1House && isHighValueHouse && holdingYears >= 3` → 표 2)
   - **표 1 분기**: `tax_rules.findHoldingRate(holdingYears, LONG_TERM_DEDUCTION_TABLE_1)` 호출
   - **표 2 분기**: `findHoldingRate(holdingYears, TABLE_2_HOLDING)` + `findResidenceRate(residenceYears, holdingYears, TABLE_2_RESIDENCE)` 호출
   - `longTermDeduction = Math.floor(taxableGain × totalRate)` (Math.floor 1회)
   - 법령 숫자 직접 보유 금지 (의사결정 #5 강화 §0-1 원칙 (3))
   - 노출 객체에 추가
   - 회귀 검증

#### 11-2-7. 단계 2·3·4 분기 본문 활성

   - 단계 2 `applyNonTaxation`: passthrough → `check1Se1HouseExemption` 호출
   - 단계 3 `applyHighValueAllocation`: passthrough → `calculateHighValuePortion` 호출 (조건부)
   - 단계 4 `computeLongTermDeduction`: 0 고정 → `calculateLongTermDeduction` 호출
   - `result.steps`에 v0.2 신규 10개 필드 추가
   - `terminateAt2 === true` 시 후속 단계 0/null 정책 적용 (§4-13-1)
   - 회귀 검증 (v0.1 골든셋 TC-001~005 통과 확인 — 자동 보정으로 다주택 처리)

#### 11-2-8. `collectIssueFlags` 카탈로그 18종 (§5)

   - `intermediates` 입력에 v0.2 신규 5종 추가 (§5-6)
   - v0.2 신규 5종 + 보조 3종 발동 추가
   - v0.1 변경 5종 발동 조건 갱신 (`HIGH_VALUE_HOUSE`·`POSSIBLE_NON_TAXATION_1H1H` 등)
   - `LONG_TERM_DEDUCTION_NOT_APPLIED` 폐기
   - `UNREGISTERED_ASSET_ASSUMED_FALSE` → `UNREGISTERED_RATE_NOT_APPLIED` 이름 변경 (Claude Code 재량, 회귀 영향 검토)
   - `HOLDING_PERIOD_BOUNDARY` 마크 확장 (1·2·3·15년 ±3일)
   - 회귀 검증

#### 11-2-9. `selfTest()` sanity 케이스 보강 (§6-1, 모듈 스펙)

   - TC-001·TC-003·TC-005 v0.1 sanity 그대로
   - TC-006·TC-008·TC-010 v0.2 sanity 추가 (모듈 스펙 §6-1 권장)
   - 부트스트랩 1회 호출 부담 검토 (수밀리초)

#### 11-2-10. `tests/tax_engine.test.js` v0.2 신규 회귀 추가 (§10-2 그룹 A~J)

   - v0.1 회귀 234건은 그대로 보존 (RULE_VERSION strict-eq 1라인 예외 인정)
   - v0.2 신규 그룹 A~J 추가
   - 골든셋 정답값은 `docs/v0.2/06_test_cases.md` v0.2.1에서 읽어 하드코딩 상수
   - `node tests/tax_engine.test.js` → 314~354건 통과 / 0건 실패 확인

### 11-3. Node.js 회귀 검증

```
cd C:\users\ds7st\documents\projects\taxopt
node tests/tax_rules.test.js     # 150/0 통과 (호출 측 모듈, baseline 유지)
node tests/tax_engine.test.js    # 314~354/0 통과 (v0.1 234 + v0.2 신규)
```

기대 출력:
- 마지막 줄 `총 N건 통과 / 0건 실패` (N ≈ 314~354)
- v0.1 회귀 234건 모두 통과 확인
- v0.2 신규 그룹 A~J 모두 통과 확인

### 11-4. selfTest 호환성 검증 (`tax_rules.js` v0.2 호출)

```
node -e "
require('./js/tax_rules.js');
require('./js/tax_engine.js');
var st = (typeof globalThis !== 'undefined' ? globalThis : window).TaxOpt.taxEngine.selfTest();
console.log('tax_engine selfTest:', st.ok ? 'ok' : 'FAILED');
console.log('  taxRulesSelfTest:', st.taxRulesSelfTest && st.taxRulesSelfTest.ok ? 'ok' : 'FAILED');
console.log('  sanityChecks:', st.sanityChecks && st.sanityChecks.ok ? 'ok' : 'FAILED');
"
```

기대 출력: `tax_engine selfTest: ok`. 모든 sanity 통과.

### 11-5. GitHub Pages 라이브 검증 (TC-006~010 5건 totalTax 일치)

배포 후 `https://ds7style.github.io/taxopt/index.html`에서 다음 콘솔 검증:

```js
// TC-006 — 1세대1주택 비과세 + 12억 이하 (전액 비과세)
var tc006 = window.TaxOpt.taxEngine.calculateSingleTransfer(/* TC-006 caseData */);
console.assert(tc006.totalTax === 0, 'TC-006 totalTax fail');

// TC-007 — 1세대1주택 + 12억 초과 (안분 + 표 2 64%)
var tc007 = window.TaxOpt.taxEngine.calculateSingleTransfer(/* TC-007 caseData */);
console.assert(tc007.totalTax === 6161100, 'TC-007 totalTax fail');

// TC-008 — 다주택 일반과세 + 표 1 (보유 12년 → 24%)
var tc008 = window.TaxOpt.taxEngine.calculateSingleTransfer(/* TC-008 caseData */);
console.assert(tc008.totalTax === 130878000, 'TC-008 totalTax fail');

// TC-009 — 1세대1주택 + 표 2 최대 80% (안분 + 0% 과세)
var tc009 = window.TaxOpt.taxEngine.calculateSingleTransfer(/* TC-009 caseData */);
console.assert(tc009.totalTax === 1383642, 'TC-009 totalTax fail');

// TC-010 — 일시적 2주택 (적용 안 함, 다주택 일반과세)
var tc010 = window.TaxOpt.taxEngine.calculateSingleTransfer(/* TC-010 caseData */);
console.assert(tc010.totalTax === 122826000, 'TC-010 totalTax fail');

// v0.1 회귀 (입력 패치 적용 후)
var tc001 = window.TaxOpt.taxEngine.calculateSingleTransfer(/* TC-001 caseData with householdHouseCount: 2 */);
console.assert(tc001.totalTax === 98241000, 'TC-001 회귀 fail');
```

기대 결과: 모든 assert 통과. console에 `tax_engine v0.2.0 selfTest ok` + `tax_rules v0.2.0 selfTest ok` 로그.

### 11-6. git commit + push

```
git add js/tax_engine.js tests/tax_engine.test.js
git commit -m "feat(tax_engine): v0.2.0 — 1세대1주택 비과세 + 고가주택 안분 + 장특공 표 1·2

- 단계 2 (applyNonTaxation): check1Se1HouseExemption 결정 트리 활성
  · 보유 2년 + (조정대상 시 거주 2년) + 12억 비교 → terminateAt2 또는 isHighValueHouse
- 단계 3 (applyHighValueAllocation): calculateHighValuePortion 안분 활성
  · allocationRatio = (salePrice − 12억) / salePrice
  · taxableGain = Math.floor(transferGain × allocationRatio)
- 단계 4 (computeLongTermDeduction): calculateLongTermDeduction 룩업 호출 패턴
  · 표 1 (다주택·1세대1주택 보유<3년): findHoldingRate(holdingYears, TABLE_1)
  · 표 2 (1세대1주택 + 12억 초과 + 보유>=3년): findHoldingRate(holdingYears, TABLE_2_HOLDING) + findResidenceRate
  · 의사결정 #5 강화 §0-1 (단일 소스/룩업 우선/산식 흐름 분리) 준수
- validateCaseData: v0.2 신규 검증 5종 + 자동 보정 7종 (B-019)
- result.steps: v0.2 신규 10종 필드 추가
- collectIssueFlags: 카탈로그 18종 확장 (신규 5 + 보조 3, 변경 5, 유지 5, 폐기 1)
- selfTest: TC-006/008/010 sanity 추가
- ENGINE_VERSION → v0.2.0
- v0.1 노출 17종 멤버 시그니처 그대로 보존 + v0.2 신규 3종 노출
- v0.1 회귀 234건 통과 (RULE_VERSION strict-eq 1라인 갱신 인정)
- TC-006~010 검증팀·홈택스·Claude 3자 일치 (totalTax 0 / 6,161,100 / 130,878,000 / 1,383,642 / 122,826,000)

Refs: docs/05_code_work_orders/04_tax_engine_v0_2.md
      docs/v0.2/modules/tax_engine.md v0.2.1
      docs/v0.2/01_calc_engine_spec.md v0.2.1
      B-019, B-020, B-024"

git push origin feat/tax-engine-v0.2   # 또는 main
```

---

## 12. 검증 체크리스트

본 절은 Claude Code 산출 후 `tax_engine.js` v0.2 + `tests/tax_engine.test.js` v0.2를 검증하는 절차다. 회귀 항목 (R-) + 신규 항목 (N-)으로 분리.

### 12-1. v0.1 회귀 안전성 (R-1 ~ R-12)

- [ ] **(R-1)** `js/tax_engine.js`가 `window.TaxOpt.taxEngine`을 노출 (모듈 스펙 §1)
- [ ] **(R-2)** v0.1 17종 노출 멤버 시그니처·반환 형식 그대로 (§3-1 표)
- [ ] **(R-3)** `ENGINE_VERSION === "v0.2.0"` (v0.1: `"v0.1.1"` 갱신)
- [ ] **(R-4)** v0.1.1 13단계 산식 (단계 1·5~13) 본문 변경 없음
- [ ] **(R-5)** `Math.floor` 절사 위치 단계 10·11 그대로
- [ ] **(R-6)** 모든 v0.1 출력 금액 필드 정수 (`Number.isInteger` 통과)
- [ ] **(R-7)** `caseData` 입력 변경 없음 (순수 함수, deep equal 검증)
- [ ] **(R-8)** 화면 DOM 접근 없음 (코드 내 `document`·`window.document` 사용 없음)
- [ ] **(R-9)** ES6 module(`import`/`export`) 미사용
- [ ] **(R-10)** `tests/tax_engine.test.js` v0.1 회귀 234건 그대로 통과 (RULE_VERSION strict-eq 1라인 갱신은 §2-3 단서 (a)에 따라 인정)
- [ ] **(R-11)** TC-001~005 골든셋 13개 항목 전체 일치 (입력 패치 `householdHouseCount: 2` 적용 후 또는 자동 보정으로)
- [ ] **(R-12)** v0.1 issueFlag 10종 발동 조건 보존 (변경 5종은 갱신 후 보존, 폐기 1종은 미발동 확인)

### 12-2. v0.2 신규 안전성 (N-1 ~ N-N)

#### 12-2-1. 노출 멤버 + 본문 활성

- [ ] **(N-1)** v0.2 신규 노출 함수 3종 존재 (`check1Se1HouseExemption`·`calculateHighValuePortion`·`calculateLongTermDeduction`)
- [ ] **(N-2)** 단계 2 본문 활성 — `applyNonTaxation` 결정 트리 (§4-2)
- [ ] **(N-3)** 단계 3 본문 활성 — `applyHighValueAllocation` 안분 (§4-3)
- [ ] **(N-4)** 단계 4 본문 활성 — `computeLongTermDeduction` 표 1·표 2 분기 (§4-4)
- [ ] **(N-5)** 단계 4 룩업 호출 패턴 (의사결정 #5 강화 §0-1 원칙 (3)) — 법령 숫자 직접 보유 금지

#### 12-2-2. 호출 측 정합성

- [ ] **(N-6)** `tax_rules.js` v0.2.0 24종 멤버 중 15종 read-only 사용 (§6-1 표)
- [ ] **(N-7)** 임계 명칭 정본 채택 (`NON_TAXABLE_HOLDING_MIN_YEARS`·`NON_TAXABLE_RESIDENCE_MIN_YEARS` — 인계 1)
- [ ] **(N-8)** 별칭 사용 금지 (`EXEMPTION_HOLDING_THRESHOLD_YEARS`·`EXEMPTION_RESIDENCE_THRESHOLD_MONTHS` — tax_engine.md v0.2.1 §8-1 별칭 사용 안 함)
- [ ] **(N-9)** 부트스트랩 가드 v0.2 추가 — `HIGH_VALUE_HOUSE_THRESHOLD`·`findHoldingRate`·`findResidenceRate` 미로드 시 throw
- [ ] **(N-10)** 호출 측 클램프 미적용 — 룩업 함수 결과 그대로 사용

#### 12-2-3. validateCaseData + result.steps

- [ ] **(N-11)** `validateCaseData` v0.2 신규 검증 5종 (§8-2)
- [ ] **(N-12)** 자동 보정 7종 룰 적용 (B-019, §8-3)
- [ ] **(N-13)** `result.steps` v0.2 신규 10종 필드 (§9-2-2)
- [ ] **(N-14)** `terminateAt2 === true` 시 후속 단계 0/null 정책 (§4-13-1)

#### 12-2-4. 절사 처리

- [ ] **(N-15)** `Math.floor` 두 번 절사 — 단계 3 안분 후 + 단계 4 장특공 적용 후
- [ ] **(N-16)** 비율 변수(`allocationRatio`·`holdingRate`·`residenceRate`·`totalRate`) 절사하지 않음

#### 12-2-5. issueFlag 카탈로그

- [ ] **(N-17)** v0.2 신규 issueFlag 5종 발동 (`IS_1SE_1HOUSE`·`IS_HIGH_VALUE_HOUSE`·`LONG_TERM_DEDUCTION_TABLE_1/2`·`ONE_TIME_2HOUSES_NOT_APPLIED`)
- [ ] **(N-18)** v0.2 보조 issueFlag 3종 발동 (`RESIDENCE_MONTHS_USER_INPUT`·`RESIDENCE_EXEMPTION_NOT_HANDLED`·`LONG_TERM_DEDUCTION_HOLDING_LESS_THAN_3Y_FOR_TABLE_2`)
- [ ] **(N-19)** v0.1 변경 5종 발동 조건 갱신 + 폐기 1종 미발동
- [ ] **(N-20)** `HOLDING_PERIOD_BOUNDARY` 마크 확장 (1·2·3·15년 ±3일)

#### 12-2-6. 회귀 통과 + 검증 결과

- [ ] **(N-21)** TC-006 totalTax === 0 (검증팀·홈택스·Claude 3자 일치)
- [ ] **(N-22)** TC-007 totalTax === 6,161,100
- [ ] **(N-23)** TC-008 totalTax === 130,878,000
- [ ] **(N-24)** TC-009 totalTax === 1,383,642
- [ ] **(N-25)** TC-010 totalTax === 122,826,000
- [ ] **(N-26)** `selfTest().ok === true`
- [ ] **(N-27)** Node.js 회귀 314~354건 통과 / 0건 실패
- [ ] **(N-28)** GitHub Pages 라이브 검증 통과 (5/2 또는 사용자 자율 시점)

### 12-3. 모듈 스펙 v0.2.1 §6·§12 검증 항목 적용

본 §12-1·§12-2는 모듈 스펙 v0.2.1의 검증 항목을 모두 흡수한다.

| 모듈 스펙 §X | 본 작업지시서 매핑 |
|---|---|
| §6-1 selfTest sanity 케이스 (TC-006/008/010) | (N-26) |
| §6-2 collectIssueFlags 18종 | (N-17)·(N-18)·(N-19)·(R-12) |
| §7 불변성 약속 | (R-7)·(R-8) |
| §8-1 tax_rules.js 사용 항목 | (N-6)·(N-7) |
| §8-2-1 부트스트랩 가드 v0.2 | (N-9) |
| §11-1 룩업 정본 (의사결정 #5 강화 §0-1) | (N-5)·(N-10) |
| §11-2 selfTest sanity 채택 | (N-26) |
| §11-3 Object.freeze 미적용 | (R-1) |

### 12-4. 차단 사항 정리 (체크리스트 미통과 시)

| 미통과 항목 | 차단 영향 | 처리 |
|---|---|---|
| (R-10)·(R-11) v0.1 회귀 234건 깨짐 | **즉시 롤백** | v0.1 17종 멤버 시그니처·반환 형식 손상 가능성 → §3-1 재확인 |
| (N-21)~(N-25) TC-006~010 totalTax 불일치 | **명세서·골든셋 재검** | 검증팀 손계산·홈택스 모의계산과 3자 일치 확정값 (KPI 100%). 코드 산출이 어긋났음을 의미 → §4-2/§4-3/§4-4 재검토 |
| (N-7)·(N-8) 임계 명칭 별칭 사용 | **인계 1 위반** | tax_rules.js 노출 멤버명과 충돌 → §6-2 정본 명칭으로 재작성 |
| (N-5) 법령 숫자 직접 보유 | **의사결정 #5 강화 §0-1 원칙 (3) 위반** | 0.06·0.02·0.04 등 매직 넘버 → tax_rules.findHoldingRate/findResidenceRate 호출로 대체 |
| (N-26) selfTest().ok false | 부트스트랩 실패 | sanity 케이스 정독 후 원인 진단 |


---

## 13. 변경 이력

| 버전 | 날짜 | 변경 내용 |
|---|---|---|
| v0.2.0 | 2026-05-02 | 초기 작성. 모듈 스펙 `docs/v0.2/modules/tax_engine.md` v0.2.1 단일 진본 + v0.1 작업지시서 02 (`docs/05_code_work_orders/02_tax_engine.md`) 패턴 계승 + 작업지시서 03 (`docs/05_code_work_orders/03_tax_rules_v0_2.md`) 호출 측 정합성 인계. (1) §1~§13 13개 절 구조. (2) §3 v0.1 17종 시그니처 보존 + v0.2 신규 3종 노출. (3) §4 13단계 산식 파이프라인 — 단계 0·2·3·4 변경분 상세 + 단계 1·5~13 v0.1.1 그대로 인용. (4) §5 issueFlag 카탈로그 18종 (유지 5 + 변경 5 + 신규 5 + 보조 3). (5) §6 호출 측 모듈 정합성 — `tax_rules.js` v0.2.0 24종 멤버 중 15종 read-only 사용 + 임계 명칭 정본 채택 (인계 1) + 부트스트랩 가드 v0.2 추가. (6) §7 절사 처리 — 단계 3·4 v0.2 신규 절사 + 단계 10·11 v0.1 그대로. (7) §8 입력 검증 — v0.2 신규 검증 5종 + 자동 보정 7종 (B-019). (8) §9 결과 객체 — v0.1 13개 필드 보존 + v0.2 신규 10개 필드 + terminateAt2 0/null 정책. (9) §10 회귀 테스트 — v0.1 234건 보존 + v0.2 신규 그룹 A~J. (10) §11 Claude Code 실행 — 사전 준비 → 코드 작성 10단계 → Node.js 회귀 → selfTest → GitHub Pages 라이브 → git commit. (11) §12 검증 체크리스트 R-1~R-12 + N-1~N-28 + 모듈 스펙 §6·§12 매핑 + 차단 사항 정리. (12) 의사결정 #5 강화 (§0-1 법령 개정 대응 아키텍처) 본문 6회 인용 + 의사결정 #9 v9 (.js 본문 산출 금지) §0-1 명시 + 의사결정 #11 (정확성 > 속도) 시간 제약 표기 없음. (13) 백로그 B-019·B-020·B-022·B-023·B-024 직접 인용. (14) 인계 4건 정확 처리: 인계 1 (임계 명칭 정본 채택) §4-2·§6-2, 인계 2 (§2-3 단서 명문화) §2-3, 인계 3 (멤버 수 정확 표기 — v0.1 17종 + v0.2 7종 = 24종) §3-4, 인계 4 (별칭 정정 백로그 등록 권고) §6-2 + 부록 A. |

---

## 부록 A — 자체 검증 결과 (작업 창 #9)

본 작업지시서 산출 직후 작업 창 #9이 수행한 자체 검증 5건 결과.

### A-1. 백로그 ID 정합성 (B-019·B-020·B-022·B-023·B-024 정독 후 매핑)

| 백로그 ID | 본 작업지시서 인용 위치 | 정합성 |
|---|---|---|
| **B-019** (자동 보정 룰 — `householdHouseCount`·`residenceMonths` 등) | 메타 표 + §4-0-1 + §8-3 + (N-12) + 인계 표 | ✅ — 본 작업의 단계 0 `validateCaseData` 자동 보정 7종 책임 명시. 작업지시서 03이 "본 모듈 범위 밖"으로 명시한 자동 보정을 본 작업이 흡수 |
| **B-020** (의사결정 #5 강화 — 법령 개정 대응 아키텍처) | 메타 표·§0-1 인용·§4-4-1 (단계 4 룩업 호출 패턴)·§6-3 (호출 측 클램프 미적용)·(N-5)·(N-10) | ✅ — §0-1 원칙 (1)(2)(3) 본문 모두 5회 이상 명시. 단계 4 룩업 호출 패턴이 본 원칙의 직접 적용 |
| **B-022** (정수 처리 — 절사 vs 반올림) | 메타 표 + §7-3 (TC-009 1원 차이 — `Math.floor` 두 번 절사 그대로 유지) | ✅ — 본 작업에서 정정 없음, v0.5+ 인계 |
| **B-023** (부칙·경과규정) | 메타 표 + §0 (v0.5+ 인계) | ✅ — 본 작업 범위 외 |
| **B-024** (tax_engine.md v0.2.1 §8-1 별칭 정정) | 메타 표 + §6-2 + 인계 4 처리 | ✅ — 별칭 사용 금지 + 모듈 스펙 차후 정정은 백로그 등록 권고 (본 관제탑 책임). 본 작업지시서는 정본 명칭 채택 |

### A-2. 모듈 스펙 인용 정합성

본 작업지시서가 인용한 모듈 스펙·명세서 §X-Y는 모두 본문 정독 후 인용했다.

| 인용 위치 | 인용 대상 | 정합성 |
|---|---|---|
| §0-1 / §3-1 / §6-2 | tax_engine.md v0.2.1 §0-1 (변경 요약) + §2-2 (노출 멤버) + §8-1 (tax_rules 사용 항목) | ✅ — 본문 정독 후 인용 |
| §4-0-1 / §8-3 | 명세서 v0.2.1 §7-3 (자동 보정 룰) | ✅ — 본문 정독 후 인용 |
| §4-2-1 | 명세서 v0.2.1 §3-1 (1세대1주택 결정 트리) | ✅ — 본문 정독 후 인용 |
| §4-3-1 | 명세서 v0.2.1 §4-2/§4-3 (안분 산식·절사 정책) | ✅ — 본문 정독 후 인용 |
| §4-4-1 | 명세서 v0.2.1 §5-2/§5-3-3 (장특공 표 1·표 2 룩업) + 모듈 스펙 §5-3-1 (`calculateLongTermDeduction` 계약) | ✅ — 본문 정독 후 인용. v0.2.1 정정 (등차수열 산식 폐기) 명시 |
| §4-13-1 / §9-3 | 모듈 스펙 v0.2.1 §4-2-1 (terminateAt2 후속 단계 0/null 정책) | ✅ — 본문 정독 후 인용 |
| §5-1~§5-6 | 명세서 v0.2.1 §6-1~§6-6 (issueFlag 카탈로그 18종) + 모듈 스펙 §6-2-1 (intermediates 보강) | ✅ — 본문 정독 후 인용 |
| §6-1 | 모듈 스펙 v0.2.1 §8-1 표 (호출 멤버 일람) | ✅ — 정본 명칭과 별칭 비교 후 정본 채택 |
| §6-4 | 모듈 스펙 v0.2.1 §8-2/§8-2-1 (부트스트랩 가드) + §8-3 (selfTest 호출) | ✅ — 본문 정독 후 인용 |
| §11-2-9 | 모듈 스펙 v0.2.1 §6-1 (selfTest sanity 케이스 권장) + §11-2 (보류 항목 채택 결정) | ✅ — 본문 정독 후 인용 |

### A-3. v0.1 회귀 안전성 검증

| 항목 | 검증 결과 |
|---|---|
| v0.1 17종 노출 멤버 시그니처·반환 형식 보존 | ✅ — §3-1 표 명시. `ENGINE_VERSION` 문자열만 갱신 |
| v0.1 234건 회귀 테스트 통과 가능 | ✅ — §2-3 단서로 RULE_VERSION 1라인 strict-eq 갱신 인정 |
| v0.1 골든셋 TC-001~005 회귀 통과 가능 | ✅ — 자동 보정 룰(`HOUSEHOLD_COUNT_INFERRED`)이 v0.1 입력의 `salePlan.candidateHouseIds.length`로 다주택 처리 → 비과세 분기 회피. 안전을 위해 입력 패치(`householdHouseCount: 2`) 권고 |
| v0.1 issueFlag 10종 발동 조건 보존 | ✅ — 변경 5종은 갱신 후 보존, 폐기 1종(`LONG_TERM_DEDUCTION_NOT_APPLIED`)은 미발동 |

### A-4. v0.2 신규 검증 항목 명시

| 모듈 스펙 §X 검증 항목 | 본 작업지시서 매핑 |
|---|---|
| §6-1 selfTest sanity 케이스 (TC-006·008·010) | §11-2-9 + (N-26) |
| §6-2 collectIssueFlags 18종 | §5-1~§5-6 + (N-17)·(N-18)·(N-19) |
| §7 불변성 약속 | §10-2-9 그룹 I + (R-7) |
| §8-1 tax_rules.js 사용 항목 (15종) | §6-1 표 + (N-6) |
| §8-2-1 부트스트랩 가드 v0.2 | §6-4 + (N-9) |
| §11-1 룩업 정본 (의사결정 #5 강화 §0-1) | §4-4-1 + §6-3 + (N-5)·(N-10) |
| §11-2 selfTest sanity 채택 | §11-2-9 + (N-26) |
| §11-3 Object.freeze 미적용 | (R-1) |
| TC-006~010 5건 totalTax 정합 | §11-5 + §10-2-3 + (N-21)~(N-25) |

### A-5. 자체 발견 짚을 부분 (3건)

본 작업지시서 작성 중 발견한 짚을 부분 3건. Claude Code 실행 시 추가 확인 필요.

#### 짚을 부분 1: tax_engine.md v0.2.1 §8-1 별칭 vs 정본 명칭 충돌 (인계 1·4)

- **현상**: tax_engine.md v0.2.1 §8-1 의존성 표가 `EXEMPTION_HOLDING_THRESHOLD_YEARS`·`EXEMPTION_RESIDENCE_THRESHOLD_MONTHS`로 표기. 모듈 스펙 v0.2.0 tax_rules.md §3-5는 정본 명칭 `NON_TAXABLE_HOLDING_MIN_YEARS`·`NON_TAXABLE_RESIDENCE_MIN_YEARS`만 노출. 단위도 다름 (`_YEARS` vs `_MONTHS`). 작업지시서 03 §5-3 호환성 메모 + tax_rules.js v0.2.0 코드 모두 정본 명칭만 사용 중.
- **본 작업지시서 처리**: 정본 명칭 채택 + 별칭 사용 금지 명시 (§4-2·§6-2·N-7·N-8). 호출 측 비교 식: `residenceMonths >= NON_TAXABLE_RESIDENCE_MIN_YEARS * 12`.
- **추가 처리 권고 (관제탑 책임)**: tax_engine.md v0.2.1 §8-1 정정 + 백로그 B-024 등록.

#### 짚을 부분 2: 시스템 프롬프트 인계 3 "v0.1 13종" 표기 vs 모듈 스펙 "v0.1 17종" 충돌 (인계 3)

- **현상**: 시스템 프롬프트의 "인계 3"이 "v0.1 tax_rules.js: 13종 노출"로 표기. 그러나 모듈 스펙 v0.1.1·v0.2.0 §2-2 + 작업지시서 03 §3-1 모두 "v0.1 17종"으로 표기. tax_rules.js v0.1.1 코드도 17종 노출 중.
- **본 작업지시서 처리**: 모듈 스펙·작업지시서 03 정본 채택 ("v0.1 17종 + v0.2 신규 7종 = 24종"). §3-4·§6-1 표.
- **추가 처리 권고 (관제탑 책임)**: 시스템 프롬프트 표기 정정 (다음 작업 창 신설 시).

#### 짚을 부분 3: v0.1 골든셋 입력 패치 vs 자동 보정 룰 정합성

- **현상**: 명세서 v0.2.1 §9-1은 v0.1 골든셋 TC-001~005 입력에 `householdHouseCount: 2` 추가 패치 권고. 본 작업지시서 §4-0-1은 자동 보정 룰(`HOUSEHOLD_COUNT_INFERRED`)이 `salePlan.candidateHouseIds.length`로 추정. v0.1 골든셋의 `candidateHouseIds: ["A", "B"]` 같은 다주택 케이스는 자동으로 `householdHouseCount = 2`로 보정될 가능성. 그러나 v0.1 골든셋이 단일 후보(`candidateHouseIds: ["A"]`)인 경우는 자동 보정으로 1세대1주택 분기 진입 → v0.1 결과와 충돌 가능.
- **본 작업지시서 처리**: §11-2-7 단계 2·3·4 활성화 후 v0.1 골든셋 회귀 검증 항목 추가. §10-2-4 그룹 D (TC-001~005 v0.1 회귀, 입력 패치 적용 후) 명시.
- **추가 처리 권고 (Claude Code 실행 시)**: v0.1 골든셋의 정확한 `candidateHouseIds` 구조를 `docs/v0.1/06_test_cases.md`에서 확인 후, 자동 보정만으로 회귀 통과 여부 검증. 회귀 실패 시 `docs/v0.1/06_test_cases.md` v0.1.2 패치 (`householdHouseCount: 2` 명시 추가) 함께 적용.

---

## 부록 B — Claude Code 실행 환경 명시

본 작업지시서는 Claude Code 환경에서 실행:

- 로컬: `C:\users\ds7st\documents\projects\taxopt`
- Node.js: `tests/` 회귀 검증
- VS Code 통합 터미널: PowerShell + Git Bash
- Git: commit + push

### B-1. Claude Code의 책임

- `js/tax_engine.js` 코드 작성·수정 (v0.1.1 → v0.2.0 패치)
- `tests/tax_engine.test.js` 코드 작성·수정 (v0.1 234건 보존 + v0.2 신규 추가)
- Node.js 회귀 테스트 실행 (`node tests/tax_engine.test.js`)
- selfTest 호환성 검증
- GitHub Pages 라이브 검증 (TC-006~010 5건 totalTax 일치 확인)
- 결과 보고 + git commit + push

### B-2. 본 작업지시서의 책임

- Claude Code에 정확한 코드 사양 전달
- 13단계 파이프라인 명확 분기 명시
- 회귀 안전성·신규 안전성 검증 항목 명시
- 인계 4건 정확 처리

---

(끝)

# Code 작업지시서 03 — tax_rules.js v0.2 + 회귀 테스트 v0.2

| 항목 | 내용 |
|---|---|
| 문서 ID | `docs/05_code_work_orders/03_tax_rules_v0_2.md` |
| 버전 | v0.2.0 |
| 작성일 | 2026-05-01 |
| 작성 출처 | 작업 창 #8 (작업지시서 03 작성 전용) |
| 작업 대상 | Claude Code |
| 선행 작업 | 작업지시서 01 (`docs/05_code_work_orders/01_tax_rules.md`) ✅ 완료 (Node.js 67/0 통과) / 작업지시서 02 (`docs/05_code_work_orders/02_tax_engine.md`) ✅ 완료 (Node.js 234/0 + GitHub Pages 라이브 검증 통과) |
| 후속 작업 | 작업지시서 04 (`tax_engine.js` v0.2 패치) — 본 작업 산출 후 작성 |
| 입력 자료 | `docs/v0.2/modules/tax_rules.md` v0.2.0 (단일 진본, 820줄) |
| 의사결정 준수 | #5 강화 (법령 개정 대응 아키텍처 — 단일 소스/룩업 우선/산식 흐름 분리), #6 (영속화 의무), **#9 v9 (.js 본문 산출 금지)**, #11 (정확성 > 속도) |
| 백로그 반영 | **B-019 (자동 보정 — 본 모듈 범위 밖, 작업지시서 04에서 처리)**, **B-020 (의사결정 #5 강화 — §0-1 사전 적용)**, B-022 (양도소득세 정수 처리 — 본 산출에서는 v0.2.1 결정 그대로 유지), B-023 (부칙·경과규정 — v0.5+ 인계) |

---

## 0. 작업 목표 — 한 문장 요약

`tax_rules.js`를 v0.1.1 → v0.2.0으로 패치하여 (1) 장기보유특별공제 표 1·표 2 좌측·표 2 우측 룩업 테이블 3종, (2) 12억 임계·비과세 보유/거주 임계 3종, (3) 룩업 함수 `findHoldingRate`·`findResidenceRate` 2종, (4) 정수 임계 배열 `HOLDING_PERIOD_BOUNDARY_YEARS` 1종, (5) `verifyLongTermLookups()` 자체검증 1종을 신규 노출하고, **v0.1.1의 17종 노출 멤버 시그니처·값과 v0.1 회귀 테스트 67건을 그대로 보존**한다.

본 작업의 성공 기준은 **(a) v0.1 회귀 테스트 67건이 모두 그대로 통과하고, (b) v0.2 신규 검증 항목 10건이 모두 통과하며, (c) `tax_rules.selfTest().ok === true`** 가 충족되는 것이다. 산식·테이블·임계는 모두 `docs/v0.2/modules/tax_rules.md` v0.2.0이 단일 정본이며, 본 작업지시서는 모듈 스펙을 코드로 옮기는 절차서다.

### 0-1. 산출물 분담 (의사결정 #9 v9 재확인)

| 산출물 | 산출 주체 | 본 작업지시서의 역할 |
|---|---|---|
| `js/tax_rules.js` (v0.2 패치) | **Claude Code** | 사양·체크리스트 제공 |
| `tests/tax_rules.test.js` (v0.2 패치) | **Claude Code** | 회귀·신규 검증 항목 제공 |
| `docs/05_code_work_orders/03_tax_rules_v0_2.md` | 작업 창 #8 (본 문서) | 1회 작성, 영속화 후 인계 |
| `js/tax_engine.js` v0.2 패치 | (작업지시서 04 — 별건) | 본 작업지시서 범위 외 |

본 작업 창은 .js 코드 본문을 산출하지 않는다. 본 문서의 코드 골격(데이터 정의 표·함수 시그니처·sanity 입출력 대응표)은 **참고용 reference skeleton**이며, 완성된 .js 파일은 Claude Code가 본 문서 + 모듈 스펙 v0.2.0 + v0.1 기존 코드(`js/tax_rules.js`)를 함께 참조하여 작성한다.

---

## 1. 선행 자료 (Claude Code가 먼저 읽어야 하는 문서·코드)

다음 자료를 본 작업지시서와 함께 읽는다. 충돌 시 우선순위는 위 → 아래 순.

| 우선순위 | 자료 | 역할 |
|---|---|---|
| 1 | `docs/v0.2/modules/tax_rules.md` v0.2.0 (820줄) | **단일 진본** — 룩업 테이블·헬퍼 함수·검증 정본 |
| 2 | `docs/v0.2/01_calc_engine_spec.md` v0.2.1 (§0-1) | 법령 개정 대응 아키텍처 원칙 |
| 3 | `docs/v0.1/modules/tax_rules.md` v0.1.1 (235줄) | v0.1 베이스 — 17종 노출 멤버 그대로 보존 |
| 4 | `js/tax_rules.js` (현 v0.1.1 코드) | v0.1 패턴 (IIFE·`globalThis` fallback·검증 함수 패턴) |
| 5 | `tests/tax_rules.test.js` (현 v0.1.1 회귀 67건) | 회귀 케이스 — 그대로 보존 |
| 6 | `docs/v0.2/06_test_cases.md` v0.2.1 (TC-006~010 검증 결과) | 본 모듈 sanity의 회귀 보호 대상 |
| 7 | `docs/v0.2/modules/tax_engine.md` v0.2.1 (§8-1 사용 멤버 표) | 호출 측 read-only 의존 — 본 모듈 노출 책임 확정 |
| 8 | `docs/99_decision_log.md` v11 (#5 강화·#9 v9·#11) | 코드 아키텍처 원칙 |
| 9 | `docs/98_backlog.md` (B-019·B-020·B-022·B-023) | 본 모듈과 직접 연관 백로그 |

> **읽는 순서 권고**: ① 본 작업지시서 §0~§3로 큰 그림 파악 → ② `docs/v0.2/modules/tax_rules.md` v0.2.0 §1~§4 정독 → ③ 현 `js/tax_rules.js` 정독 (v0.1 IIFE 패턴·`globalThis` fallback 패턴 그대로 계승) → ④ 본 작업지시서 §4~§13 순으로 코드 작성. 산식·임계 의문 발생 시 모듈 스펙 v0.2.0이 정본.

---

## 2. 산출 파일 목록

### 2-1. `js/tax_rules.js` (v0.1.1 → v0.2.0 패치)

| 항목 | 내용 |
|---|---|
| 위치 | `js/tax_rules.js` (repo root) |
| 변경 유형 | 기존 파일 패치 (신규 생성 아님) |
| v0.1 노출 멤버 보존 | **17종 시그니처·값 그대로** (단 `RULE_VERSION` 문자열만 갱신) |
| v0.2 신규 노출 추가 | **7종** (룩업 테이블 3 + 임계 3 + 임계 배열 1) — 이 외에 헬퍼 함수 2종 + 자체검증 함수 1종 = 노출 객체 총 24종 |
| 신규 행수 추정 | +200~+300줄 (v0.1 약 320줄 → v0.2 약 520~620줄) |

### 2-2. `tests/tax_rules.test.js` (v0.1 → v0.2 패치)

| 항목 | 내용 |
|---|---|
| 위치 | `tests/tax_rules.test.js` (repo root) |
| 변경 유형 | 기존 파일 패치 (신규 생성 아님) |
| v0.1 회귀 케이스 보존 | **67건 그대로** (수정·삭제·치환 금지) |
| v0.2 신규 회귀 케이스 | sanity 15건 + 입력 검증 throw 케이스 + 클램프 케이스 + 노출 멤버 존재성 확인 등. 정확한 건수는 Claude Code가 결정하되 §10-2의 항목을 빠짐없이 포함 |
| 출력 형식 | v0.1 패턴 그대로 — `=== tax_rules v0.X.X 회귀 테스트 ===` 헤더 + 그룹별 통과 표시 + 마지막 줄 `총 N건 통과 / 0건 실패` |

### 2-3. 변경 금지 (본 작업 범위 외)

- `js/tax_engine.js` (v0.1.1 그대로. v0.2 패치는 작업지시서 04 책임)
- `tests/tax_engine.test.js` (v0.1.1 그대로. v0.2 패치는 작업지시서 04 책임)
- `index.html` (v0.2 시점 추가 `<script>` 없음 — 본 모듈은 기존 `<script src="js/tax_rules.js">` 그대로 사용)
- `docs/v0.2/modules/tax_rules.md` v0.2.0 (검증 완료 단일 진본)
- `docs/v0.2/01_calc_engine_spec.md` v0.2.1 (검증 완료 정본)
- `docs/v0.2/06_test_cases.md` v0.2.1 (3자 일치 골든셋)

---

## 3. tax_rules.js v0.2 변경 요약

### 3-1. v0.1 17종 멤버 그대로 유지 (시그니처·값 보존)

다음 17종은 **이름·타입·값·반환 형식 모두 v0.1.1 그대로**다. v0.2 패치 후에도 v0.1 회귀 테스트 67건이 깨지지 않아야 한다.

| 카테고리 | 멤버 | 비고 |
|---|---|---|
| 메타데이터 (3종) | `RULE_VERSION`, `APPLICABLE_SALE_DATE_FROM`, `LAW_REFS` | `RULE_VERSION` 문자열만 갱신 (§3-1-1). `LAW_REFS`는 키 추가만 (§3-2-1) |
| 금액·세율 상수 (5종) | `BASIC_DEDUCTION_AMOUNT`, `LOCAL_INCOME_TAX_RATE`, `SHORT_TERM_RATE_UNDER_1Y`, `SHORT_TERM_RATE_UNDER_2Y`, `UNREGISTERED_RATE` | 값 그대로. `UNREGISTERED_RATE` 이름 유지 (모듈 스펙 §11-5 결정) |
| 룩업 테이블 (1종) | `PROGRESSIVE_BRACKETS` | 8행 그대로 |
| 헬퍼 함수 (1종) | `findBracket(taxBase)` | 시그니처·반환 객체 그대로 |
| 자체검증 함수 (4종) | `selfTest()`, `verifyProgressiveContinuity()`, `verifyBaseTaxAreIntegers()`, `verifyMonotonic()` | `selfTest()`만 결과 객체에 `longTermLookups` 필드 추가 (§9-3). 나머지 3종 본문 변경 없음 |

> **`RULE_VERSION` 갱신**: `"v0.1.1-post-20260510"` → **`"v0.2.0-post-20260510"`**. v0.1 테스트가 이 값을 단순 비교하지 않고 패턴(`/^v0\./`) 또는 존재 확인만 한다면 회귀 영향 없음. 단순 문자열 일치 검증 라인이 있다면 v0.2 회귀 테스트 추가 시 함께 갱신.

#### 3-1-1. `LAW_REFS` 4키 추가 (v0.2 신규)

`LAW_REFS`는 v0.1.1에서 6종을 노출. v0.2 신규 issueFlag 5종 + v0.2 신규 룩업 항목들이 인용하는 법령 라벨 4종을 추가하여 **총 10종**이 된다. 정확한 키 이름·라벨 텍스트는 모듈 스펙 v0.2.0 §3-6 또는 명세서 v0.2.1 §6 (issueFlag 카탈로그)의 lawRef 컬럼을 그대로 따른다.

추가 4키의 의미적 출처(키 이름은 Claude Code가 모듈 스펙 정독 후 매핑):

1. 소득세법 제89조 ①ⅲ (1세대1주택 비과세 본조)
2. 소득세법 시행령 제154조 ① (보유 2년·거주 2년 요건)
3. 소득세법 제95조 ② (장특공 표 1·2 본조 — v0.1.1에서 이미 일부 인용 중인 경우 키 통합 검토)
4. 소득세법 시행령 제160조 ① (고가주택 안분 산식)

> **인용 정합성 원칙**: 본 4키의 정확한 라벨 문자열은 v0.1.1 `LAW_REFS`의 기존 키 라벨 형식(예: `"소득세법 제104조 ⑦"`)과 일관되게 작성한다. v0.1.1 코드의 `LAW_REFS` 객체를 그대로 베이스로 하여 v0.2 키만 append (기존 키 변경 금지).

### 3-2. v0.2 신규 7종 노출 추가 + 헬퍼 2종 + 자체검증 1종 = 합계 24종

> 노출 객체 멤버 24종 = v0.1 17종 + v0.2 데이터 7종 (룩업 테이블 3 + 임계 3 + 임계 배열 1) — 단, **헬퍼 함수 `findHoldingRate`·`findResidenceRate`** 2종과 **자체검증 `verifyLongTermLookups`** 1종 또한 v0.2 신규로 노출된다. 모듈 스펙 v0.2.0 §2-2의 카테고리 구분을 따른다.

| 신규 카테고리 | 멤버 | 정의 위치 |
|---|---|---|
| 룩업 테이블 (3종) | `LONG_TERM_DEDUCTION_TABLE_1` (13행), `LONG_TERM_DEDUCTION_TABLE_2_HOLDING` (8행), `LONG_TERM_DEDUCTION_TABLE_2_RESIDENCE` (9행, 단서 메타필드) | §4 |
| 임계 상수 (3종) | `HIGH_VALUE_HOUSE_THRESHOLD` (1,200,000,000), `NON_TAXABLE_HOLDING_MIN_YEARS` (2), `NON_TAXABLE_RESIDENCE_MIN_YEARS` (2) | §5 |
| 임계 배열 (1종) | `HOLDING_PERIOD_BOUNDARY_YEARS` (`[1, 2, 3, 15]`) | §5-4 |
| 헬퍼 함수 (2종) | `findHoldingRate(holdingYears, table)`, `findResidenceRate(residenceYears, holdingYears, table)` | §6 |
| 자체검증 (1종) | `verifyLongTermLookups()` | §9-2 |

### 3-3. `selfTest()` 결과 객체 보강 (`longTermLookups` 필드)

`selfTest()`의 입력·반환 시그니처는 v0.1과 동일하되, 반환 객체에 `longTermLookups` 필드가 추가된다. 모듈 스펙 v0.2.0 §9-1의 결과 구조를 그대로 따른다:

```
selfTest() => {
  ok: boolean,                              // 4종 검증 모두 ok이면 true (v0.1 3종 + v0.2 1종)
  continuity:           { ok, checks },     // v0.1 — PROGRESSIVE_BRACKETS 7개 등식 (그대로)
  integers:             { ok, fails },      // v0.1 — baseTax 8개 정수 (그대로)
  monotonic:            { ok, fails },      // v0.1 — lowerBound·marginalRate·baseTax 단조성 (그대로)
  longTermLookups: {                        // v0.2 신규
    ok:                       boolean,
    table1Fails:              Array,        // 표 1 sanity 5건
    table2HoldingFails:       Array,        // 표 2 좌측 sanity 3건
    table2ResidenceFails:     Array         // 표 2 우측 sanity 7건
  }
}
```

> **호출 측 영향 없음**: v0.1 호출 측(`tax_engine.js` v0.1.1)은 `selfTest().ok`만 참조하므로, 새 필드 추가는 회귀 영향 없음. v0.2 `tax_engine.js` 패치(작업지시서 04)에서도 `ok`만 참조하면 충분.

> **합산 책임**: `selfTest()`의 최상위 `ok`는 4종 모두 `ok === true`이어야 `true`. 이 합산 로직은 v0.1과 동일 패턴 (v0.1은 3종 합산 → v0.2는 4종 합산).

---

## 4. 데이터 정의 — 룩업 테이블

본 §4 모든 데이터는 **모듈 스펙 v0.2.0 §3 본문이 단일 정본**이다. 본 작업지시서는 행 수·정답값·메타필드 요건만 재확인한다. 행 데이터 정확값은 모듈 스펙 v0.2.0 §3-2-2·§3-3-1·§3-3-2를 정독하여 그대로 옮긴다.

### 4-1. `PROGRESSIVE_BRACKETS` (v0.1 그대로)

- 행 수: **8**
- 원소 스키마: `{ idx, lowerBound, upperBound, marginalRate, baseTax, label }`
- 8개 정답값: v0.1.1 모듈 스펙 §4-2 그대로 (변경 없음)
- 검증: v0.1 `verifyProgressiveContinuity` + `verifyBaseTaxAreIntegers` + `verifyMonotonic`로 보장 (그대로)

### 4-2. `LONG_TERM_DEDUCTION_TABLE_1` (v0.2 신규 — 장특공 표 1, 일반)

- 근거: 소득세법 제95조 ② 표 1 (시행령 제159조의3 위임)
- 행 수: **13**
- 원소 스키마:

```js
{
  idx:        number,     // 1~13
  lowerBound: number,     // 정수, 보유연수 하한 (포함, 단위: 년)
  upperBound: number,     // 정수 또는 Infinity (idx=13만)
  rate:       number,     // 0.06, 0.08, ..., 0.30
  label:      string      // "3년 이상 4년 미만" 등
}
```

- 13개 행 정답값: 모듈 스펙 v0.2.0 §3-2-2 표 그대로
  - idx=1: `{ lowerBound: 3, upperBound: 4, rate: 0.06, label: "3년 이상 4년 미만" }`
  - idx=2: rate 0.08 (`4~5`년)
  - idx=3: rate 0.10 (`5~6`년) — TC-010 회귀 키
  - … (등차 0.02씩 증가) …
  - idx=10: rate 0.24 (`12~13`년) — TC-008 회귀 키
  - …
  - idx=13: `{ lowerBound: 15, upperBound: Infinity, rate: 0.30, label: "15년 이상" }`

> **v0.2.1 정정 적용**: `0.06 + (n−3) × 0.02` 같은 등차수열 산식으로 행 데이터를 생성하지 않는다. 13행 모두 **수기로 표 그대로** 정의한다 (의사결정 #5 강화 — §0-1 원칙 (2)). 산식 형태는 법령 표가 등차수열을 깨는 방향으로 개정될 때 즉시 위반으로 전환되므로 금지.

### 4-3. `LONG_TERM_DEDUCTION_TABLE_2_HOLDING` (v0.2 신규 — 표 2 좌측, 보유공제율)

- 근거: 소득세법 제95조 ② 표 2 좌측 (시행령 제159조의4 위임)
- 행 수: **8**
- 원소 스키마: 표 1과 동일 (`idx, lowerBound, upperBound, rate, label`)
- 8개 행 정답값: 모듈 스펙 v0.2.0 §3-3-1 표 그대로
  - idx=1: rate 0.12 (`3~4`년)
  - idx=2: rate 0.16 (`4~5`년)
  - …
  - idx=6: rate 0.32 (`8~9`년) — TC-007 회귀 키
  - …
  - idx=8: `{ lowerBound: 10, upperBound: Infinity, rate: 0.40, label: "10년 이상" }` — TC-009 클램프 회귀 키

> **표 1과 행 수가 다름**: 표 1은 13행(15년까지), 표 2 좌측은 8행(10년까지). 같은 등차수열 형태로 보일 수 있으나 산식 표기 금지 (§0-1 원칙 (2)).

### 4-4. `LONG_TERM_DEDUCTION_TABLE_2_RESIDENCE` (v0.2 신규 — 표 2 우측, 거주공제율 + 단서)

- 근거: 소득세법 제95조 ② 표 2 우측 (시행령 제159조의4 위임)
- 행 수: **9** (좌측보다 1행 많음 — idx=1이 거주 2~3년 미만 단서 행)
- 원소 스키마 (표 1·표 2 좌측보다 메타필드 1개 더):

```js
{
  idx:                    number,     // 1~9
  lowerBound:             number,     // 거주연수 하한 (포함, 단위: 년)
  upperBound:             number,     // 정수 또는 Infinity (idx=9만)
  rate:                   number,     // 0.08, 0.12, ..., 0.40
  requiresHoldingMin3y:   boolean,    // "보유 3년 이상" 단서 적용 행 — 9행 모두 true
  label:                  string
}
```

- 9개 행 정답값: 모듈 스펙 v0.2.0 §3-3-2 표 그대로
  - idx=1: `{ lowerBound: 2, upperBound: 3, rate: 0.08, requiresHoldingMin3y: true, label: "2년 이상 3년 미만 (보유 3년 이상 한정)" }` — **단서 시작 행, 거주 2~3년 미만 8%**
  - idx=2: rate 0.12 (`3~4`년)
  - …
  - idx=7: rate 0.32 (`8~9`년) — TC-007 회귀 키
  - …
  - idx=9: `{ lowerBound: 10, upperBound: Infinity, rate: 0.40, requiresHoldingMin3y: true, label: "10년 이상" }` — TC-009 클램프 회귀 키

> **`requiresHoldingMin3y` 메타필드는 9행 모두 `true`**. 표 2 우측 자체가 시행령 제95조 ② 표 2 우측 본문상 "보유 3년 이상" 단서 적용 대상이므로 전 행 동일 메타값. `findResidenceRate`는 본 메타를 직접 참조하지 않고 `holdingYears < 3`에서 0 반환으로 단속 (방어적). 메타필드는 향후 데이터 자기 검증·UI 라벨 표시·v0.5+ 부칙 분기 시 활용 예정.

> **모듈 스펙 §3-3-2 정독 필수**: idx=1이 단서 행이라는 점, 9행 전부 `requiresHoldingMin3y: true` 정의라는 점, idx=9 `upperBound: Infinity`라는 점 — 이 3가지를 코드에서 정확히 옮긴다.

---

## 5. 임계 상수 (v0.2 신규)

본 §5 모든 상수는 **단일 소스** (의사결정 #5 강화 §0-1 원칙 (1)). `tax_engine.js`·`scenario_engine.js`·`input_collector.js` 어느 다른 모듈도 본 임계 숫자를 직접 보유하지 않는다.

### 5-1. `HIGH_VALUE_HOUSE_THRESHOLD` (12억원)

```
HIGH_VALUE_HOUSE_THRESHOLD = 1200000000   // 원 (정수)
```

- 근거: 소득세법 제89조 제1항 제3호 단서 (시행령 제156조 ①)
- 호출: `tax_engine.js` 단계 2 (1세대1주택 비과세) + 단계 3 (12억 초과 안분 산식)
- 안분 산식: `(salePrice − HIGH_VALUE_HOUSE_THRESHOLD) / salePrice` (시행령 제160조 ①, **`tax_engine.js` 책임** — 본 모듈은 임계만 노출)

### 5-2. `NON_TAXABLE_HOLDING_MIN_YEARS` (보유 2년)

```
NON_TAXABLE_HOLDING_MIN_YEARS = 2   // 년 (정수)
```

- 근거: 소득세법 시행령 제154조 ①
- 호출: `tax_engine.js` 단계 2 (보유요건 — `saleDate >= addYearsAnchored(acquisitionDate, 2)` 비교 시점)

### 5-3. `NON_TAXABLE_RESIDENCE_MIN_YEARS` (거주 2년)

```
NON_TAXABLE_RESIDENCE_MIN_YEARS = 2   // 년 (정수)
```

- 근거: 소득세법 시행령 제154조 ① (취득시 조정대상지역 한정)
- 호출: `tax_engine.js` 단계 2 (`acquisitionRegulated === true` 케이스에서 `residenceMonths >= 24` 비교)

> **단위 통일성**: 본 모듈은 `_MIN_YEARS` 단위로만 노출한다. `tax_engine.js`가 `residenceMonths` 입력을 받을 때 24개월 비교는 `residenceMonths >= NON_TAXABLE_RESIDENCE_MIN_YEARS * 12` 형태로 호출 측에서 처리. 본 모듈은 `EXEMPTION_RESIDENCE_THRESHOLD_MONTHS` 같은 개월 단위 상수를 별도 노출하지 않는다 (모듈 스펙 §3-5 결정).

> **호출 측 명세 충돌 방지 메모**: `docs/v0.2/modules/tax_engine.md` v0.2.1 §8-1 의존성 표는 `EXEMPTION_HOLDING_THRESHOLD_YEARS`·`EXEMPTION_RESIDENCE_THRESHOLD_MONTHS` 명칭으로 표기되어 있다. 그러나 모듈 스펙 v0.2.0 §3-5에서 본 모듈의 노출 멤버명은 **`NON_TAXABLE_HOLDING_MIN_YEARS`·`NON_TAXABLE_RESIDENCE_MIN_YEARS`** (모두 년 단위)로 확정. 이는 본 모듈 스펙이 정본이며, 작업지시서 04 (tax_engine v0.2 패치) 단계에서 호출 측이 이 이름·단위를 사용하도록 정렬한다. **본 작업에서는 모듈 스펙 v0.2.0 §3-5 이름·값을 그대로 채택**한다. (참고로 본 짚을 부분은 §13 자체 검증 결과 표의 "자체 발견 짚을 부분"에 명시)

### 5-4. `HOLDING_PERIOD_BOUNDARY_YEARS` (정수 임계 배열)

```
HOLDING_PERIOD_BOUNDARY_YEARS = [1, 2, 3, 15]   // 년 (정수 배열)
```

- 근거: 시행령 제155조 단서 (1년/2년 마크), 제95조 ② (3년 시작·15년 상한)
- 호출: `tax_engine.js` `collectIssueFlags`에서 `HOLDING_PERIOD_BOUNDARY` issueFlag 발동 임계로 사용
- 모듈 스펙 §11-4 결정: **본 모듈은 정수 임계 배열만 노출**. 일자 단위 ±3일 비교(`addYearsAnchored` + `Math.abs((saleDate − mark) in days) <= 3`)는 `tax_engine.js` 책임 (§0-1 원칙 (3) 산식 흐름 분리)

---

## 6. 헬퍼 함수 (v0.2 신규)

본 §6 함수 시그니처·입력 검증·클램프 정책·sanity 케이스는 **모듈 스펙 v0.2.0 §4가 단일 정본**이다.

### 6-1. `findBracket(taxBase)` (v0.1 그대로)

- 입력: `taxBase: number` (정수, ≥ 0)
- 출력: `{ idx, marginalRate, baseTax, lowerBound, upperBound, label }` (PROGRESSIVE_BRACKETS 1행)
- 검증: 음수·비정수·NaN·Infinity·문자열·null·undefined → `Error` throw
- v0.1.1 모듈 스펙 §5 그대로. 본문 변경 없음.

### 6-2. `findHoldingRate(holdingYears, table)` (v0.2 신규)

장특공 표 1·표 2 좌측 공통 룩업 함수.

| 항목 | 내용 |
|---|---|
| 입력 1 | `holdingYears: number` (정수, ≥ 0) |
| 입력 2 | `table: object[]` (`LONG_TERM_DEDUCTION_TABLE_1` 또는 `LONG_TERM_DEDUCTION_TABLE_2_HOLDING`) |
| 출력 | `rate: number` (0 ≤ rate ≤ 표 최대 행 rate) |
| 부수효과 | 없음 (순수 함수, `table` 참조 보존) |
| 결정성 | 동일 입력 → 동일 출력 |

#### 6-2-1. 입력 검증 (모듈 스펙 §4-2-1)

| 입력 | 결과 |
|---|---|
| `holdingYears`가 비정수·NaN·Infinity·문자열·null·undefined | `Error` throw |
| `holdingYears < 0` | `Error` throw |
| `table`이 배열이 아니거나 `length === 0` | `Error` throw |

> 검증 메시지 예시: `'findHoldingRate: holdingYears는 0 이상 정수여야 합니다.'`, `'findHoldingRate: table은 비어있지 않은 배열이어야 합니다.'`. 정확한 문자열은 v0.1 `findBracket` 검증 메시지 패턴과 일관되게 Claude Code가 결정.

#### 6-2-2. 클램프 정책 (모듈 스펙 §4-2-2 — **함수 내부 처리**, 호출 측 클램프 미적용)

| 입력 | 반환값 |
|---|---|
| `holdingYears < table[0].lowerBound` (표 1·표 2 좌측 모두 3년 미만) | **0** |
| `holdingYears >= table[table.length - 1].lowerBound` (표 1: 15년, 표 2 좌측: 10년) | **표 최대 행 `rate`** (클램프) |
| 그 외 | 해당 행 `rate` |

#### 6-2-3. sanity 케이스 (모듈 스펙 §4-2-3, 8건 — selfTest 통합 검증 대상)

| 입력 | 표 | 출력 | 출처 |
|---|---|---|---|
| `findHoldingRate(2, TABLE_1)` | 표 1 | `0` | 보유 < 3년 (표 1 적용 없음) |
| `findHoldingRate(3, TABLE_1)` | 표 1 | `0.06` | 표 1 idx=1 (시작 경계) |
| `findHoldingRate(5, TABLE_1)` | 표 1 | `0.10` | TC-010 (보유 5년 → 10%) |
| `findHoldingRate(12, TABLE_1)` | 표 1 | `0.24` | TC-008 (보유 12년 → 24%) |
| `findHoldingRate(20, TABLE_1)` | 표 1 | `0.30` | 15년 이상 클램프 |
| `findHoldingRate(8, TABLE_2_HOLDING)` | 표 2 좌측 | `0.32` | TC-007 (보유 8년 → 32%) |
| `findHoldingRate(10, TABLE_2_HOLDING)` | 표 2 좌측 | `0.40` | TC-009 (10년 이상 클램프) |
| `findHoldingRate(50, TABLE_2_HOLDING)` | 표 2 좌측 | `0.40` | 클램프 |

### 6-3. `findResidenceRate(residenceYears, holdingYears, table)` (v0.2 신규)

장특공 표 2 우측 거주공제율 룩업 함수. 단서(보유 3년 이상) 단속 포함.

| 항목 | 내용 |
|---|---|
| 입력 1 | `residenceYears: number` (정수, ≥ 0) |
| 입력 2 | `holdingYears: number` (정수, ≥ 0) — **단서 단속용 필수 입력** |
| 입력 3 | `table: object[]` (`LONG_TERM_DEDUCTION_TABLE_2_RESIDENCE`) |
| 출력 | `rate: number` (0 ≤ rate ≤ 0.40) |
| 부수효과 | 없음 (순수 함수) |
| 결정성 | 동일 입력 → 동일 출력 |

#### 6-3-1. 입력 검증 (모듈 스펙 §4-3-1)

| 입력 | 결과 |
|---|---|
| `residenceYears`·`holdingYears` 중 하나라도 비정수·NaN·Infinity·문자열·null·undefined | `Error` throw |
| `residenceYears < 0` 또는 `holdingYears < 0` | `Error` throw |
| `table`이 배열이 아니거나 `length === 0` | `Error` throw |

#### 6-3-2. 클램프·단서 정책 (모듈 스펙 §4-3-2 — **함수 내부 처리**)

| 조건 (위에서부터 순차 평가) | 반환값 | 근거 |
|---|---|---|
| `holdingYears < 3` | **0** | 표 2 우측 전 행 단서 (보유 3년 이상 한정) |
| `residenceYears < 2` | **0** | 표 2 우측 시작 행 (거주 2년 미만 미적용) |
| `2 <= residenceYears < 3` | **0.08** | 단서 행 idx=1 (보유 3년 이상에서만 활성) |
| `residenceYears >= table[table.length - 1].lowerBound` (10년 이상) | **0.40** | 표 최대 행 클램프 |
| 그 외 | 해당 행 `rate` | 표 2 우측 idx=2~8 |

> **평가 순서가 중요**: `holdingYears < 3` 가드를 먼저 평가하여 `residenceYears`와 무관하게 0 반환. 그래야 `findResidenceRate(2, 2, TABLE)` 케이스가 0을 반환 (단서 미충족).

#### 6-3-3. sanity 케이스 (모듈 스펙 §4-3-3, 7건 — selfTest 통합 검증 대상)

| 입력 (residenceYears, holdingYears) | 출력 | 의미 |
|---|---|---|
| `findResidenceRate(2, 2, TABLE_2_RESIDENCE)` | `0` | 보유 < 3년 단서 차단 (모듈 스펙 §12-4 #8) |
| `findResidenceRate(2, 5, TABLE_2_RESIDENCE)` | `0.08` | 단서 행 활성 (보유 5년 + 거주 2~3년 미만) (§12-4 #7) |
| `findResidenceRate(8, 8, TABLE_2_RESIDENCE)` | `0.32` | TC-007 (보유 8년 거주 8년 → 32%) (§12-4 #5) |
| `findResidenceRate(10, 10, TABLE_2_RESIDENCE)` | `0.40` | TC-009 클램프 (§12-4 #6) |
| `findResidenceRate(0, 5, TABLE_2_RESIDENCE)` | `0` | 거주 0년 (`< 2년`) |
| `findResidenceRate(3, 3, TABLE_2_RESIDENCE)` | `0.12` | 표 2 우측 idx=2 (보유 3년 거주 3년) |
| `findResidenceRate(50, 50, TABLE_2_RESIDENCE)` | `0.40` | 거주 클램프 |

> 위 7건은 모듈 스펙 §4-3-3 sanity 7건과 일치. selfTest의 `verifyLongTermLookups()`가 본 7건을 반복 검증하며, `tests/tax_rules.test.js`도 동일 7건을 그룹으로 가진다.

---

## 7. 입력 검증 패턴 (룩업 함수 공통)

### 7-1. 검증 항목 일반 원칙

3개 룩업 함수 (`findBracket`·`findHoldingRate`·`findResidenceRate`)는 모두 **함수 진입부에서 입력 검증을 수행**한다. 검증 실패 시 `Error` throw, 호출 측이 catch하여 처리하지 않으면 부트스트랩 단계에서 즉시 발견된다.

| 검증 케이스 | 처리 |
|---|---|
| 인수 자체가 `undefined` (인수 누락) | throw |
| `null` | throw |
| 문자열 (예: `"5"`) | throw — 자동 변환 금지 |
| `NaN` | throw |
| `Infinity`·`-Infinity` | throw |
| 음수 | throw |
| 비정수 (예: `5.5`) | throw |
| 정수 0 또는 양수 | 정상 처리 |

> **`Number.isInteger()` 사용 권고**: v0.1 `findBracket`이 사용 중인 검증 패턴(`!Number.isInteger(taxBase) || taxBase < 0`)을 그대로 계승. NaN·Infinity·문자열·null·undefined는 `Number.isInteger`가 false를 반환하므로 1줄로 차단 가능. (단, `holdingYears`·`residenceYears`는 ≥ 0 허용이므로 `< 0` 비교만 추가.)

### 7-2. `table` 인자 검증

| 검증 케이스 | 처리 |
|---|---|
| `Array.isArray(table) === false` | throw |
| `table.length === 0` | throw |
| 그 외 | 정상 처리 (행별 `lowerBound`·`upperBound`·`rate` 존재성은 sanity 검증·selfTest로 회귀 보호) |

### 7-3. 검증 메시지 패턴

v0.1 `findBracket`의 메시지 형식과 일관되게 작성. 예시:

- `'findHoldingRate: holdingYears는 0 이상 정수여야 합니다. 입력값: ' + holdingYears`
- `'findResidenceRate: holdingYears·residenceYears 모두 0 이상 정수여야 합니다.'`
- `'findHoldingRate: table은 비어있지 않은 배열이어야 합니다.'`

> 정확한 메시지 문구는 회귀 테스트가 완전 일치 비교를 하지 않는 한 (`includes` 또는 prefix 매칭) Claude Code 재량.

---

## 8. 클램프 정책

### 8-1. 클램프 위치 — 룩업 함수 내부

3개 룩업 함수 모두 **클램프 처리를 함수 내부에서 수행**한다. 호출 측 (`tax_engine.js`)은 클램프를 다시 적용하지 않는다 (의사결정 #5 강화 §0-1 원칙 (3) — 산식 흐름 분리).

| 함수 | 하한 클램프 | 상한 클램프 |
|---|---|---|
| `findBracket` | `taxBase < 0` 시 throw (클램프 아님) | 마지막 구간 `upperBound: Infinity`로 자동 처리 |
| `findHoldingRate` | `holdingYears < lowerBound[0]` 시 **0 반환** | `holdingYears >= lowerBound[len-1]` 시 **최대 행 rate 반환** |
| `findResidenceRate` | `holdingYears < 3` 또는 `residenceYears < 2` 시 **0 반환** | `residenceYears >= 10` 시 **0.40 반환** |

### 8-2. 클램프 정책 검증 (회귀 테스트)

다음 클램프 케이스는 `tests/tax_rules.test.js`에 명시 (§10-2-3):

- 표 1: `findHoldingRate(2, TABLE_1) === 0` (하한), `findHoldingRate(20, TABLE_1) === 0.30` (상한 클램프)
- 표 2 좌측: `findHoldingRate(50, TABLE_2_HOLDING) === 0.40` (상한 클램프)
- 표 2 우측: `findResidenceRate(2, 2, TABLE_2_RESIDENCE) === 0` (단서 차단), `findResidenceRate(50, 50, TABLE_2_RESIDENCE) === 0.40` (상한 클램프)

---

## 9. selfTest() 보강

### 9-1. v0.1 검증 함수 3종 (그대로 유지)

| 함수 | 본문 변경 |
|---|---|
| `verifyProgressiveContinuity()` | 없음 |
| `verifyBaseTaxAreIntegers()` | 없음 |
| `verifyMonotonic()` | 없음 |

### 9-2. `verifyLongTermLookups()` (v0.2 신규)

| 항목 | 내용 |
|---|---|
| 입력 | 없음 |
| 출력 | `{ ok: boolean, table1Fails: Array, table2HoldingFails: Array, table2ResidenceFails: Array }` |
| 검증 내용 | §6-2-3 (8건 = 표 1 5건 + 표 2 좌측 3건) + §6-3-3 (표 2 우측 7건) = **합계 15건** sanity 룩업 결과를 expected와 일치 비교 |
| 부수효과 | 없음 (실패해도 throw 안 함, `ok: false` + 실패 케이스 배열 반환) |
| 호출 시점 | `selfTest()` 내부 1회 |
| `ok` 판정 | `table1Fails.length === 0 && table2HoldingFails.length === 0 && table2ResidenceFails.length === 0` |

#### 9-2-1. 검증 데이터 구조 권고 (참고 골격)

```js
// 참고 골격 — Claude Code가 정확한 형태 결정
function verifyLongTermLookups() {
  var table1Cases = [
    { input: [2, TABLE_1], expected: 0 },
    { input: [3, TABLE_1], expected: 0.06 },
    { input: [5, TABLE_1], expected: 0.10 },
    { input: [12, TABLE_1], expected: 0.24 },
    { input: [20, TABLE_1], expected: 0.30 }
  ];
  // ... table2HoldingCases (3건) ... table2ResidenceCases (7건) ...
  
  var table1Fails = [];
  table1Cases.forEach(function(c) {
    var actual = findHoldingRate.apply(null, c.input);
    if (actual !== c.expected) {
      table1Fails.push({ input: c.input, expected: c.expected, actual: actual });
    }
  });
  // ... 표 2 동일 패턴 ...
  
  return {
    ok: table1Fails.length === 0 && table2HoldingFails.length === 0 && table2ResidenceFails.length === 0,
    table1Fails: table1Fails,
    table2HoldingFails: table2HoldingFails,
    table2ResidenceFails: table2ResidenceFails
  };
}
```

> 위 골격은 참고용. Claude Code는 v0.1 `verifyProgressiveContinuity` 등의 패턴(케이스 배열 + forEach + 실패 누적)을 그대로 계승하여 작성.

### 9-3. `selfTest()` 결과 객체 보강

§3-3에 명시한 결과 구조. 본 문서의 §3-3을 그대로 따른다.

```
selfTest() {
  var continuity   = verifyProgressiveContinuity();   // v0.1
  var integers     = verifyBaseTaxAreIntegers();      // v0.1
  var monotonic    = verifyMonotonic();               // v0.1
  var longTermLookups = verifyLongTermLookups();      // v0.2 신규

  return {
    ok: continuity.ok && integers.ok && monotonic.ok && longTermLookups.ok,
    continuity:       continuity,
    integers:         integers,
    monotonic:        monotonic,
    longTermLookups:  longTermLookups
  };
}
```

> v0.1 호출 측은 `selfTest().ok`만 참조하므로 회귀 영향 없음.

### 9-4. selfTest 부담 검토 (모듈 스펙 §11-2 결정 — 채택)

- v0.1 selfTest: 7개 등식 + 8개 정수 + 6건 단조성 = 21건 검증, 수밀리초
- v0.2 추가: 룩업 15건 (sanity 케이스 단순 비교) — 부담 거의 무시
- 부트스트랩 1회 호출 (페이지 로드 시 또는 Node.js 테스트 시작 시)
- 위 부담 vs **TC-006~010 회귀 보호 가치** (룩업 한 행 오타 시 5건 중 1건 즉시 깨짐) 비교 → **채택**

---

## 10. tests/tax_rules.test.js v0.2 변경

### 10-1. v0.1 회귀 테스트 67건 그대로 보존

v0.1.1 시점 67건의 케이스는 **수정·삭제·치환·재배열 금지**. 새 케이스는 v0.1 케이스 다음 위치에 append. 출력 형식·통과 카운트 표시 패턴도 v0.1 그대로.

### 10-2. v0.2 신규 회귀 테스트

다음 6개 그룹을 v0.1 67건 다음에 추가. 그룹별 통과 표시 패턴은 v0.1 형식 그대로.

#### 10-2-1. 그룹 A — 노출 멤버 존재성 확인 (v0.2 신규 7종 + 헬퍼 2종 + 자체검증 1종 = 10건)

```
test('LONG_TERM_DEDUCTION_TABLE_1이 정의되어 있고 길이가 13이다');
test('LONG_TERM_DEDUCTION_TABLE_2_HOLDING이 정의되어 있고 길이가 8이다');
test('LONG_TERM_DEDUCTION_TABLE_2_RESIDENCE가 정의되어 있고 길이가 9이다');
test('LONG_TERM_DEDUCTION_TABLE_2_RESIDENCE의 idx=1 행이 requiresHoldingMin3y === true이다');
test('HIGH_VALUE_HOUSE_THRESHOLD === 1200000000이다');
test('NON_TAXABLE_HOLDING_MIN_YEARS === 2이다');
test('NON_TAXABLE_RESIDENCE_MIN_YEARS === 2이다');
test('HOLDING_PERIOD_BOUNDARY_YEARS deep equal [1,2,3,15]이다');
test('typeof findHoldingRate === "function"이다');
test('typeof findResidenceRate === "function"이다');
```

#### 10-2-2. 그룹 B — sanity 15건 (모듈 스펙 §12-4 항목 #1~#8 + 추가 7건)

§6-2-3 표 1 5건 + 표 2 좌측 3건 + §6-3-3 표 2 우측 7건 = 15건. 케이스 표는 §6 그대로.

특히 모듈 스펙 §12-4 신규 검증 안전성 항목 10건 모두 본 그룹에 포함되어야 한다:

| 모듈 스펙 §12-4 # | 검증 식 | 본 작업지시서 위치 |
|---|---|---|
| 1 | `findHoldingRate(12, TABLE_1) === 0.24` | §6-2-3 |
| 2 | `findHoldingRate(5, TABLE_1) === 0.10` | §6-2-3 |
| 3 | `findHoldingRate(8, TABLE_2_HOLDING) === 0.32` | §6-2-3 |
| 4 | `findHoldingRate(10, TABLE_2_HOLDING) === 0.40` | §6-2-3 |
| 5 | `findResidenceRate(8, 8, TABLE_2_RESIDENCE) === 0.32` | §6-3-3 |
| 6 | `findResidenceRate(10, 10, TABLE_2_RESIDENCE) === 0.40` | §6-3-3 |
| 7 | `findResidenceRate(2, 5, TABLE_2_RESIDENCE) === 0.08` | §6-3-3 |
| 8 | `findResidenceRate(2, 2, TABLE_2_RESIDENCE) === 0` | §6-3-3 |
| 9 | `HIGH_VALUE_HOUSE_THRESHOLD === 1200000000` | §10-2-1 |
| 10 | `RULE_VERSION === "v0.2.0-post-20260510"` | §10-2-1 또는 별도 |

#### 10-2-3. 그룹 C — 클램프 정책 검증

```
test('findHoldingRate(2, TABLE_1) === 0 (하한 클램프)');
test('findHoldingRate(20, TABLE_1) === 0.30 (상한 클램프, 표 1 idx=13)');
test('findHoldingRate(50, TABLE_2_HOLDING) === 0.40 (상한 클램프)');
test('findResidenceRate(2, 2, TABLE_2_RESIDENCE) === 0 (단서 차단 — holdingYears < 3)');
test('findResidenceRate(0, 5, TABLE_2_RESIDENCE) === 0 (거주 < 2년)');
test('findResidenceRate(50, 50, TABLE_2_RESIDENCE) === 0.40 (상한 클램프)');
```

#### 10-2-4. 그룹 D — 입력 검증 throw 케이스 (3개 룩업 함수 공통)

`findHoldingRate`·`findResidenceRate` 각각 다음 케이스에서 throw 발생:

```
test('findHoldingRate(-1, TABLE_1) throws Error');
test('findHoldingRate(5.5, TABLE_1) throws Error');
test('findHoldingRate(NaN, TABLE_1) throws Error');
test('findHoldingRate(Infinity, TABLE_1) throws Error');
test('findHoldingRate("5", TABLE_1) throws Error');
test('findHoldingRate(null, TABLE_1) throws Error');
test('findHoldingRate(undefined, TABLE_1) throws Error');
test('findHoldingRate(5, []) throws Error');
test('findHoldingRate(5, null) throws Error');
test('findHoldingRate(5, "not array") throws Error');

// findResidenceRate 동일 케이스 + holdingYears 검증
test('findResidenceRate(5, -1, TABLE_2_RESIDENCE) throws Error');
test('findResidenceRate(5, 5.5, TABLE_2_RESIDENCE) throws Error');
test('findResidenceRate(NaN, 5, TABLE_2_RESIDENCE) throws Error');
// ... 등
```

> 정확한 throw 검증 패턴은 v0.1 `findBracket`의 throw 검증 케이스와 일관되게. v0.1이 `try/catch` 패턴을 쓰면 그대로, `assert.throws` 패턴을 쓰면 그대로.

#### 10-2-5. 그룹 E — selfTest 결과 객체 검증

```
test('selfTest().ok === true');
test('selfTest().longTermLookups가 객체로 정의되어 있다');
test('selfTest().longTermLookups.ok === true');
test('selfTest().longTermLookups.table1Fails.length === 0');
test('selfTest().longTermLookups.table2HoldingFails.length === 0');
test('selfTest().longTermLookups.table2ResidenceFails.length === 0');
test('selfTest().continuity.ok === true (v0.1 회귀)');
test('selfTest().integers.ok === true (v0.1 회귀)');
test('selfTest().monotonic.ok === true (v0.1 회귀)');
```

#### 10-2-6. 그룹 F — 룩업 테이블 자기 검증

```
test('LONG_TERM_DEDUCTION_TABLE_1: 13행 모두 lowerBound·upperBound·rate 정의됨');
test('LONG_TERM_DEDUCTION_TABLE_1: rate가 엄격 단조 증가 (0.06 < 0.08 < ... < 0.30)');
test('LONG_TERM_DEDUCTION_TABLE_1: idx=13 upperBound === Infinity');
test('LONG_TERM_DEDUCTION_TABLE_2_HOLDING: 8행, idx=8 upperBound === Infinity');
test('LONG_TERM_DEDUCTION_TABLE_2_RESIDENCE: 9행, idx=9 upperBound === Infinity');
test('LONG_TERM_DEDUCTION_TABLE_2_RESIDENCE: 모든 행 requiresHoldingMin3y === true');
test('LONG_TERM_DEDUCTION_TABLE_1 행 사이 lowerBound[i] === upperBound[i-1]');
test('LONG_TERM_DEDUCTION_TABLE_2_HOLDING 행 사이 lowerBound[i] === upperBound[i-1]');
test('LONG_TERM_DEDUCTION_TABLE_2_RESIDENCE 행 사이 lowerBound[i] === upperBound[i-1]');
```

### 10-3. 예상 회귀 테스트 수 — Claude Code가 결정

본 작업지시서의 §10-2 항목을 모두 포함하면 v0.2 신규 회귀 케이스는 약 50~70건. v0.1 67건 + v0.2 N건 = **약 117~137건** 통과 예상.

마지막 줄 출력 형식:

```
=== tax_rules v0.2.0 회귀 테스트 ===
[1/9] PROGRESSIVE_BRACKETS 정수성 ........................... X/X 통과 (v0.1 회귀)
[2/9] PROGRESSIVE_BRACKETS 누진 연속성 ...................... X/X 통과 (v0.1 회귀)
[3/9] PROGRESSIVE_BRACKETS 단조성 ........................... X/X 통과 (v0.1 회귀)
[4/9] findBracket 동작 ...................................... X/X 통과 (v0.1 회귀)
[5/9] selfTest 부트스트랩 ................................... X/X 통과 (v0.1 회귀 + v0.2 신규)
[6/9] v0.2 노출 멤버 존재성 ................................. 10/10 통과
[7/9] v0.2 sanity 케이스 (장특공 룩업 15건) ................. 15/15 통과
[8/9] v0.2 클램프 + 입력 검증 throw ......................... XX/XX 통과
[9/9] v0.2 룩업 테이블 자기 검증 ............................ X/X 통과

총 N건 통과 / 0건 실패
```

> 그룹 분할·라벨은 Claude Code 재량. v0.1 출력 패턴과 일관되게.

---

## 11. Claude Code 실행 절차

### 11-1. 사전 준비

1. 작업 브랜치 생성 권고 (선택):
   ```
   cd C:\users\ds7st\documents\projects\taxopt
   git checkout -b feat/tax-rules-v0.2
   ```
   > 직접 main에 작업해도 무방 (의사결정 #6 영속화 의무 — git push로 영속). 단 v0.2 코드 단계에서 검증 실패 시 롤백 부담을 줄이려면 별도 브랜치 권고.

2. 현 v0.1.1 코드·테스트 상태 확인:
   ```
   node tests/tax_rules.test.js     # 67/0 통과 확인
   node tests/tax_engine.test.js    # 234/0 통과 확인 (회귀 베이스 라인)
   ```

3. 본 작업지시서 + 모듈 스펙 v0.2.0 정독:
   - `docs/05_code_work_orders/03_tax_rules_v0_2.md` (본 문서)
   - `docs/v0.2/modules/tax_rules.md` v0.2.0 (단일 진본)

### 11-2. 코드 작성

다음 순서 권고 (한 번에 하나씩, 단계별 Node.js 회귀 검증):

1. **§4 룩업 테이블 3종 추가** (`LONG_TERM_DEDUCTION_TABLE_1`·`_2_HOLDING`·`_2_RESIDENCE`)
   - 13 + 8 + 9 = 30행 정의 (모듈 스펙 §3-2-2·§3-3-1·§3-3-2 정독 후 옮김)
   - **수기로 한 행씩 작성** (등차수열 산식 금지)
   - 노출 객체에 추가
   - `node tests/tax_rules.test.js` → v0.1 67건 그대로 통과 확인

2. **§5 임계 상수 3종 + 임계 배열 1종 추가**
   - `HIGH_VALUE_HOUSE_THRESHOLD = 1200000000`
   - `NON_TAXABLE_HOLDING_MIN_YEARS = 2`
   - `NON_TAXABLE_RESIDENCE_MIN_YEARS = 2`
   - `HOLDING_PERIOD_BOUNDARY_YEARS = [1, 2, 3, 15]`
   - 노출 객체에 추가
   - 회귀 검증

3. **§6 헬퍼 함수 2종 추가** (`findHoldingRate`, `findResidenceRate`)
   - 입력 검증 (§6-2-1·§6-3-1)
   - 클램프 정책 (§6-2-2·§6-3-2 — **함수 내부**)
   - sanity 케이스로 임시 console.log 검증 (선택)
   - 노출 객체에 추가
   - 회귀 검증

4. **§9 `verifyLongTermLookups()` 추가 + `selfTest()` 보강**
   - 15건 sanity 케이스 정의
   - 결과 객체에 `longTermLookups` 필드 추가
   - 노출 객체에 추가
   - 회귀 검증

5. **`RULE_VERSION` 갱신** + **`LAW_REFS` 4키 추가**
   - `RULE_VERSION` → `"v0.2.0-post-20260510"`
   - `LAW_REFS`에 v0.2 신규 4키 추가 (§3-1-1)
   - 회귀 검증 (이 시점에서 v0.1 회귀 테스트 중 `RULE_VERSION` 문자열 일치 비교가 있다면 v0.2 회귀 추가 후 함께 갱신)

6. **`tests/tax_rules.test.js` v0.2 신규 회귀 추가** (§10-2 그룹 A~F)

### 11-3. Node.js 회귀 검증

```
cd C:\users\ds7st\documents\projects\taxopt
node tests/tax_rules.test.js
```

기대 출력:
- 마지막 줄 `총 N건 통과 / 0건 실패` (N ≈ 117~137)
- v0.1 회귀 67건 모두 통과 확인
- v0.2 신규 그룹 A~F 모두 통과 확인

### 11-4. 부트스트랩 가드 검증 (`tax_engine.js` v0.2 호환성)

작업지시서 04 (tax_engine.js v0.2 패치)는 본 모듈에 **v0.2 추가 가드**를 둘 예정 (모듈 스펙 §8-2-1):

```js
if (typeof window.TaxOpt.taxRules.HIGH_VALUE_HOUSE_THRESHOLD === 'undefined') {
  throw new Error('tax_engine v0.2: tax_rules v0.2 (장특공 표·12억 임계 등) 미로드.');
}
```

본 작업의 산출 (`tax_rules.js` v0.2)은 **본 가드를 통과해야** 한다. 즉 `HIGH_VALUE_HOUSE_THRESHOLD`가 `window.TaxOpt.taxRules`에 노출되어 `typeof !== 'undefined'`여야 한다. §10-2-1 그룹 A의 케이스로 사전 검증.

### 11-5. tax_engine.js v0.1.1 회귀 영향 검증 (선행 안전망)

본 모듈 패치 후, `tax_engine.js` v0.1.1은 **변경 없이** 회귀 테스트를 통과해야 한다 (v0.1 호출 측은 v0.1 17종 멤버만 사용하므로). 다음을 확인:

```
node tests/tax_engine.test.js
```

기대 출력: **234/0** (v0.1.1 베이스라인 그대로). 깨지면 v0.1 17종 멤버가 손상된 것이므로 즉시 롤백 후 §3-1 재확인.

### 11-6. GitHub Pages 라이브 검증 (별도 작업, 본 작업지시서 범위 외)

작업지시서 04 (tax_engine.js v0.2 패치) 산출 후 별도 수행. 본 작업지시서는 Node.js 회귀 통과까지 책임.

### 11-7. git commit + push

```
git add js/tax_rules.js tests/tax_rules.test.js
git commit -m "feat(tax_rules): v0.2.0 — 장특공 표 1·2 룩업 테이블 + 12억 임계 + 비과세 임계

- LONG_TERM_DEDUCTION_TABLE_1 (13행), _2_HOLDING (8행), _2_RESIDENCE (9행 + 단서 메타필드) 추가
- HIGH_VALUE_HOUSE_THRESHOLD, NON_TAXABLE_HOLDING_MIN_YEARS, NON_TAXABLE_RESIDENCE_MIN_YEARS 추가
- HOLDING_PERIOD_BOUNDARY_YEARS [1,2,3,15] 추가
- findHoldingRate, findResidenceRate 룩업 함수 추가 (클램프·단서 단속 포함)
- verifyLongTermLookups + selfTest 결과 객체에 longTermLookups 필드 추가
- LAW_REFS에 v0.2 신규 4키 추가 / RULE_VERSION → v0.2.0-post-20260510
- v0.1 17종 노출 멤버 시그니처·값 그대로 보존
- v0.1 회귀 테스트 67건 통과 + v0.2 신규 회귀 테스트 N건 통과
- 의사결정 #5 강화 §0-1 (단일 소스/룩업 우선/산식 흐름 분리) 준수

Refs: docs/05_code_work_orders/03_tax_rules_v0_2.md
      docs/v0.2/modules/tax_rules.md v0.2.0
      B-019, B-020"

git push origin feat/tax-rules-v0.2   # 또는 main
```

---

## 12. 검증 체크리스트

본 절은 Claude Code 산출 후 `tax_rules.js` v0.2 + `tests/tax_rules.test.js` v0.2를 검증하는 절차다.

### 12-1. v0.1 회귀 안전성 (17종 멤버, 67건 테스트)

- [ ] **(R-1)** `RULE_VERSION` 변경 외에 v0.1 17종 멤버의 시그니처·값·반환 형식이 그대로다
- [ ] **(R-2)** `BASIC_DEDUCTION_AMOUNT === 2500000`이다
- [ ] **(R-3)** `LOCAL_INCOME_TAX_RATE === 0.1`이다
- [ ] **(R-4)** `SHORT_TERM_RATE_UNDER_1Y === 0.7`, `SHORT_TERM_RATE_UNDER_2Y === 0.6`이다
- [ ] **(R-5)** `UNREGISTERED_RATE === 0.7`이고 이름 변경 없음 (모듈 스펙 §11-5)
- [ ] **(R-6)** `PROGRESSIVE_BRACKETS`이 8행이고 행 데이터 모두 v0.1.1 그대로다
- [ ] **(R-7)** `findBracket(taxBase)` 본문 변경 없고 v0.1 동작 그대로다
- [ ] **(R-8)** `verifyProgressiveContinuity`·`verifyBaseTaxAreIntegers`·`verifyMonotonic` 본문 변경 없다
- [ ] **(R-9)** `node tests/tax_rules.test.js` v0.1 67건 그대로 통과 (수정·삭제·치환 없음)
- [ ] **(R-10)** `node tests/tax_engine.test.js` v0.1.1 234건 그대로 통과 (회귀 영향 없음)
- [ ] **(R-11)** `LAW_REFS`의 v0.1 6키가 그대로 존재한다 (키 추가만 허용)
- [ ] **(R-12)** `APPLICABLE_SALE_DATE_FROM === "2026-05-10"`이다

### 12-2. v0.2 신규 안전성 (24종 멤버, sanity 15건, 모듈 스펙 §12-4)

- [ ] **(N-1)** `RULE_VERSION === "v0.2.0-post-20260510"`이다 (모듈 스펙 §12-4 #10)
- [ ] **(N-2)** `LONG_TERM_DEDUCTION_TABLE_1.length === 13`이다
- [ ] **(N-3)** `LONG_TERM_DEDUCTION_TABLE_2_HOLDING.length === 8`이다
- [ ] **(N-4)** `LONG_TERM_DEDUCTION_TABLE_2_RESIDENCE.length === 9`이다
- [ ] **(N-5)** 표 2 우측 idx=1 행이 `requiresHoldingMin3y === true`다
- [ ] **(N-6)** 표 2 우측 9행 모두 `requiresHoldingMin3y === true`다
- [ ] **(N-7)** `HIGH_VALUE_HOUSE_THRESHOLD === 1200000000`이다 (모듈 스펙 §12-4 #9)
- [ ] **(N-8)** `NON_TAXABLE_HOLDING_MIN_YEARS === 2`, `NON_TAXABLE_RESIDENCE_MIN_YEARS === 2`이다
- [ ] **(N-9)** `HOLDING_PERIOD_BOUNDARY_YEARS` deep equal `[1, 2, 3, 15]`이다
- [ ] **(N-10)** `findHoldingRate`·`findResidenceRate` 모두 정의되고 함수다
- [ ] **(N-11)** `verifyLongTermLookups()`가 정의되고 함수다
- [ ] **(N-12)** sanity 15건 모두 expected 일치 (모듈 스펙 §12-4 #1~#8 포함, 표 1 5건 + 표 2 좌측 3건 + 표 2 우측 7건)
- [ ] **(N-13)** 입력 검증 throw 케이스 모두 throw (음수·NaN·Infinity·문자열·null·undefined·비정수)
- [ ] **(N-14)** 클램프 정책 함수 내부 처리 (호출 측 클램프 미적용)
- [ ] **(N-15)** `selfTest().ok === true`이다 (4종 검증 모두 통과)
- [ ] **(N-16)** `selfTest().longTermLookups.ok === true`이다
- [ ] **(N-17)** `Object.freeze` 미적용 (모듈 스펙 §11-3 결정)
- [ ] **(N-18)** ES6 module(`import`/`export`) 미사용, IIFE 패턴 + `globalThis` fallback 그대로

### 12-3. 모듈 스펙 §12-3·§12-4 검증 항목 적용

본 §12-1·§12-2는 모듈 스펙 v0.2.0 §12-3 (회귀 안전성 보장 항목 3건)·§12-4 (신규 검증 안전성 보장 항목 10건)을 모두 흡수한다.

| 모듈 스펙 항목 | 본 작업지시서 매핑 |
|---|---|
| §12-3 #1 (v0.1 selfTest ok) | (R-1)·(N-15) |
| §12-3 #2 (v0.1 17종 멤버 그대로) | (R-1)~(R-12) |
| §12-3 #3 (v0.1 골든셋 회귀) | (R-10) |
| §12-4 #1~#8 (sanity 8건) | (N-12) |
| §12-4 #9 (`HIGH_VALUE_HOUSE_THRESHOLD`) | (N-7) |
| §12-4 #10 (`RULE_VERSION`) | (N-1) |

### 12-4. 모듈 스펙 §13-2·§13-3 점검표 적용

| 모듈 스펙 §13 점검 | 본 작업지시서 매핑 |
|---|---|
| §13-2 (Claude Code 산출 .js 체크 9건) | (N-1)·(N-2~N-4)·(N-5)·(N-13)·(N-14)·(N-15)·(N-17)·(R-5) |
| §13-3 (Claude Code 산출 .test.js 체크 3건) | (R-9)·(N-12)·(N-16) |

> §13-4 (v0.2 골든셋 회귀, TC-006~010 + TC-001~005 입력 패치)는 작업지시서 04 (tax_engine v0.2) 단계 검증 항목이며 본 작업 범위 외.

### 12-5. 차단 사항 정리 (체크리스트 미통과 시)

| 미통과 항목 | 차단 영향 | 처리 |
|---|---|---|
| (R-9)·(R-10) v0.1 회귀 깨짐 | **즉시 롤백** | v0.1 17종 멤버 손상 가능성 → §3-1 재확인 |
| (N-12) sanity 케이스 1건 이상 깨짐 | **테이블 데이터 오타** | 모듈 스펙 §3-2-2·§3-3-1·§3-3-2 정독 후 행 단위 재검 |
| (N-17) Object.freeze 적용됨 | 정책 위반 | 모듈 스펙 §11-3 재확인, freeze 제거 |
| (N-15) selfTest().ok false | 부트스트랩 실패 | 4종 검증 결과 정독 후 원인 진단 |

---

## 13. 변경 이력

| 버전 | 날짜 | 변경 내용 |
|---|---|---|
| v0.2.0 | 2026-05-01 | 초기 작성. 모듈 스펙 `docs/v0.2/modules/tax_rules.md` v0.2.0 (820줄) 단일 진본 + v0.1 작업지시서 01 패턴 계승. (1) §1~§13 13개 절 구조. (2) §3 v0.1 17종 멤버 보존 + v0.2 신규 7종 + 헬퍼 2종 + 자체검증 1종 = 노출 24종. (3) §4 룩업 테이블 4종 (13+8+9 + PROGRESSIVE_BRACKETS 8) 정본 사양. (4) §5 임계 상수 3종 + 임계 배열 1종. (5) §6 헬퍼 함수 3종 시그니처·검증·클램프·sanity. (6) §9 selfTest 보강 (longTermLookups 필드). (7) §10 회귀 테스트 6개 그룹 (멤버 존재성·sanity 15·클램프·throw·selfTest 결과·테이블 자기 검증). (8) §11 Claude Code 실행 6단계 절차 + git commit 메시지. (9) §12 검증 체크리스트 R-1~R-12 + N-1~N-18 + 모듈 스펙 §12-3·§12-4·§13 매핑. (10) 의사결정 #5 강화 (§0-1 법령 개정 대응 아키텍처) 본문 6회 인용 + 의사결정 #9 v9 (.js 본문 산출 금지) §0-1 명시 + 의사결정 #11 (정확성 > 속도) 시간 제약 표기 없음. (11) 백로그 B-019·B-020 직접 인용, B-022·B-023 §3-1·§5-3 인계 표기. |

---

## 부록 A — 자체 검증 결과 (작업 창 #8)

본 작업지시서 산출 직후 작업 창 #8이 수행한 자체 검증 5건 결과.

### A-1. 백로그 ID 정합성 (B-019·B-020·B-022·B-023 정독 후 매핑)

| 백로그 ID | 본 작업지시서 인용 위치 | 정합성 |
|---|---|---|
| B-019 (자동 보정 룰 — householdHouseCount·residenceMonths) | 메타 표 + §0 (메타) | ✅ — 본 모듈은 자동 보정 책임 없음 (input_collector 또는 tax_engine validateCaseData 책임). 메타 표에 "본 모듈 범위 밖" 명시 |
| B-020 (의사결정 #5 강화 — 법령 개정 대응 아키텍처) | 메타 표·§0-1 인용 6회·§4 룩업 정본·§5 단일 소스·§6 산식 흐름 분리 | ✅ — §0-1 원칙 (1)(2)(3) 본문 모두 6회 이상 명시 |
| B-022 (정수 처리 — 절사 vs 반올림) | 메타 표 + §3-1 (RULE_VERSION 갱신 외 v0.1 그대로) | ✅ — 본 모듈은 절사·반올림 적용 없음 (`tax_engine.js` 책임). 본 작업에서 정정 없음, v0.5+ 인계 |
| B-023 (부칙·경과규정) | 메타 표 + §0-1 §5-3 (보유 2년 단일 임계 — 부칙 분기 미적용) | ✅ — v0.5+ 인계, 본 작업 범위 외 |

### A-2. 모듈 스펙 인용 정합성 (`tax_rules.md` v0.2.0 §X-Y 정독 후 인용)

| 본 작업지시서 §X | 모듈 스펙 §Y 정독 후 인용 |
|---|---|
| §1 (참고 자료 우선순위) | §1-1·§1-2·§1-3 단일 진본 선언 |
| §3-1 (v0.1 17종 보존) | §1-3 변경 요약 표 (`RULE_VERSION` 외 v0.1 그대로) |
| §3-2 (v0.2 신규 노출) | §2-2 노출 멤버 일람 (24종) |
| §3-3 (selfTest 보강) | §9-1 selfTest 결과 구조 |
| §4-2 (TABLE_1 13행) | §3-2-2 표 1 13행 정답값 |
| §4-3 (TABLE_2_HOLDING 8행) | §3-3-1 표 2 좌측 8행 정답값 |
| §4-4 (TABLE_2_RESIDENCE 9행 + 단서) | §3-3-2 표 2 우측 9행 + `requiresHoldingMin3y` 메타필드 |
| §5-1 (HIGH_VALUE_HOUSE_THRESHOLD) | §3-4 |
| §5-2~3 (NON_TAXABLE_*_MIN_YEARS) | §3-5 (단위 통일성 — 년 단위만 노출) |
| §5-4 (HOLDING_PERIOD_BOUNDARY_YEARS) | §3-6-4 + §11-4 결정 |
| §6-2 (findHoldingRate) | §4-2 시그니처·검증·클램프·sanity |
| §6-3 (findResidenceRate) | §4-3 시그니처·검증·단서·sanity |
| §9-2 (verifyLongTermLookups) | §9-3 |
| §11 (Object.freeze 미적용) | §11-3 결정 |
| §12-3 (모듈 스펙 §12-3·§12-4 매핑) | §12-3 회귀·§12-4 신규 |

### A-3. v0.1 회귀 안전성 검증

| 보장 항목 | 본 작업지시서 명시 |
|---|---|
| 17종 노출 멤버 시그니처·값 그대로 | §3-1 + (R-1)~(R-12) |
| 67건 회귀 테스트 그대로 통과 | §10-1 + (R-9) |
| `tax_engine.js` v0.1.1 회귀 영향 없음 | §11-5 + (R-10) |
| `RULE_VERSION` 갱신만 변경 (v0.1 테스트 영향 점검 필요 시 §11-2 5단계 안내) | §3-1 + §11-2 5단계 |

### A-4. v0.2 신규 검증 항목 명시

| 모듈 스펙 §12-4 항목 (10건) | 본 작업지시서 위치 |
|---|---|
| #1~#8 sanity 8건 | §6-2-3 + §6-3-3 + §10-2-2 표 |
| #9 `HIGH_VALUE_HOUSE_THRESHOLD === 1200000000` | §5-1 + §10-2-1 + (N-7) |
| #10 `RULE_VERSION === "v0.2.0-post-20260510"` | §3-1 + §10-2-1 + (N-1) |

| 모듈 스펙 sanity 15건 | 본 작업지시서 위치 |
|---|---|
| 표 1 5건 (`findHoldingRate(2,3,5,12,20, TABLE_1)`) | §6-2-3 표 |
| 표 2 좌측 3건 (`findHoldingRate(8,10,50, TABLE_2_HOLDING)`) | §6-2-3 표 |
| 표 2 우측 7건 (`findResidenceRate` 7건) | §6-3-3 표 |

### A-5. 자체 발견 짚을 부분

본 작업지시서 작성 중 발견한 짚을 부분 — Claude Code 실행 또는 작업지시서 04 작성 시 추가 확인 필요:

#### A-5-1. 단계별 임계 명칭 충돌 (모듈 스펙 vs tax_engine.md)

- **현상**: `docs/v0.2/modules/tax_engine.md` v0.2.1 §8-1 의존성 표는 비과세 임계를 `EXEMPTION_HOLDING_THRESHOLD_YEARS` (= 2)와 `EXEMPTION_RESIDENCE_THRESHOLD_MONTHS` (= 24, 개월 단위)로 표기한다.
- **반면**: `docs/v0.2/modules/tax_rules.md` v0.2.0 §3-5는 `NON_TAXABLE_HOLDING_MIN_YEARS` (= 2)와 `NON_TAXABLE_RESIDENCE_MIN_YEARS` (= 2, **년 단위**)로 노출 확정.
- **본 작업의 처리**: 본 모듈 스펙(`tax_rules.md` v0.2.0)이 정본이므로 **`NON_TAXABLE_HOLDING_MIN_YEARS`·`NON_TAXABLE_RESIDENCE_MIN_YEARS` 그대로 채택**한다 (§5-2·§5-3).
- **인계 항목 (작업지시서 04)**: `tax_engine.js` v0.2 패치 시 호출 측이 `EXEMPTION_HOLDING_THRESHOLD_YEARS` 같은 별칭을 기대하지 않도록 본 모듈 노출 멤버명을 그대로 사용해야 한다. 또한 `residenceMonths >= 24` 비교는 호출 측에서 `residenceMonths >= NON_TAXABLE_RESIDENCE_MIN_YEARS * 12`로 작성. 작업지시서 04 작성 시 `tax_engine.md` §8-1의 명칭을 본 모듈 노출 멤버명으로 정렬해야 한다.

#### A-5-2. `RULE_VERSION` 단순 일치 비교 회귀 위험

- **현상**: v0.1 회귀 테스트 67건 중 `RULE_VERSION === "v0.1.1-post-20260510"` 같은 **완전 일치 비교** 케이스가 있을 가능성. 본 모듈은 `RULE_VERSION` 문자열을 갱신해야 하므로 (§3-1) 해당 케이스가 있다면 v0.1 회귀가 깨진다.
- **Claude Code 실행 시 처리**:
  1. v0.1 `tests/tax_rules.test.js`에서 `RULE_VERSION` 문자열 비교 라인 검색
  2. **완전 일치 비교**가 있으면 v0.2 회귀 테스트로 갱신 (값 갱신만, 케이스 삭제 금지)
  3. **패턴 매칭** (예: `/^v0\./` 또는 `existsTest`)이라면 그대로 통과 — 갱신 불요
- **본 작업지시서 §11-2 5단계에 이미 안내**되어 있음.

#### A-5-3. `LAW_REFS` v0.2 신규 4키의 정확한 키 이름

- **현상**: 모듈 스펙 v0.2.0 §3-6에서 `LAW_REFS`의 v0.2 신규 4키 정확한 키 이름을 본 작업지시서에서 직접 옮기지 않았다 (의미적 출처 4종만 명시 §3-1-1).
- **이유**: 모듈 스펙 §3-6 본문 + 명세서 v0.2.1 §6 issueFlag 카탈로그의 `lawRef` 컬럼이 단일 정본이며, 둘 사이 키 이름이 일관되어야 한다. 본 작업지시서가 키 이름을 임의로 정하면 명세서와의 정합성 위험.
- **Claude Code 실행 시 처리**: `tax_rules.md` v0.2.0 §3-6 본문 + 명세서 v0.2.1 §6 카탈로그를 정독하여 키 이름을 그대로 옮긴다. 본 모듈 v0.1.1 코드의 `LAW_REFS` 객체 형식과 일관되게.
- **모듈 스펙 §3-6 인용 위치**: "v0.1 계승 상수·메타데이터 상세" 절. 작업 창 #7이 정본 키 이름을 명시했는지 확인 후 옮김.

#### A-5-4. v0.1 `selfTest()` 합산 로직의 v0.2 확장

- **현상**: v0.1 `selfTest().ok`는 `continuity.ok && integers.ok && monotonic.ok` 형태로 3건 AND 합산 추정. v0.2는 4건이 되므로 합산 로직 1줄 갱신 필요.
- **Claude Code 실행 시 처리**: §9-3 결과 객체 합산 로직 그대로 따른다. v0.1 코드 본문의 합산 라인 검색 → `&& longTermLookups.ok` 추가.

#### A-5-5. selfTest 호출 시점·로깅 방식

- **현상**: v0.1 `js/tax_rules.js` 마지막 줄 또는 `index.html`의 인라인 `<script>`에서 `selfTest()`를 호출하여 콘솔에 `tax_rules selfTest ok` 로그를 출력하는 패턴 추정.
- **Claude Code 실행 시 처리**: v0.1 코드의 호출 위치·로그 메시지 형식을 그대로 계승. 본 모듈 패치는 selfTest 본문 보강만이며 호출 위치 변경 없음.

#### A-5-6. v0.2 회귀 테스트의 `RULE_VERSION` 비교 갱신

- **현상**: §10-2-1 그룹 A에 `RULE_VERSION === "v0.2.0-post-20260510"` 케이스 추가가 있다. v0.1 회귀가 패턴 매칭이라면 v0.2 회귀에 정확값 케이스를 신규 추가해도 무방. v0.1 회귀가 완전 일치라면 v0.2 회귀에서 값을 갱신.
- **Claude Code 실행 시 처리**: A-5-2와 동일.

#### A-5-7. 작업지시서 04 의존 사항 (인계)

본 작업지시서 산출 후 작업지시서 04 (`tax_engine.js` v0.2 패치) 작성 시 다음을 본 모듈 산출에 의존:

| 의존 항목 | 본 모듈 산출 후 작업지시서 04에 인계 |
|---|---|
| 노출 멤버명 정합성 | `NON_TAXABLE_HOLDING_MIN_YEARS`·`NON_TAXABLE_RESIDENCE_MIN_YEARS` 그대로 사용 (A-5-1 처리) |
| 부트스트랩 가드 | `tax_engine.js` v0.2의 §8-2-1 추가 가드(`HIGH_VALUE_HOUSE_THRESHOLD === 'undefined'` 차단) 가드 대상 멤버 정합성 |
| 룩업 함수 호출 패턴 | `tax_rules.findHoldingRate(holdingYears, tax_rules.LONG_TERM_DEDUCTION_TABLE_1)` 등 호출 인자 표준 (`tax_engine.md` §8-1 참조) |
| `LAW_REFS` 신규 4키 | `tax_engine.js` v0.2의 issueFlag 5종(`IS_1SE_1HOUSE` 등) `lawRef` 매핑 |

### A-6. 인용 자료 미비 — 없음

본 작업지시서 작성 중 인용한 자료는 모두 프로젝트 지식에 영속화된 정본 문서이며, 미비 항목 없음.

### A-7. 자체 sanity 검증

| 항목 | 결과 |
|---|---|
| 모듈 스펙 §3-2-2 표 1 13행 카운트 | ✅ 13행 |
| 모듈 스펙 §3-3-1 표 2 좌측 8행 카운트 | ✅ 8행 |
| 모듈 스펙 §3-3-2 표 2 우측 9행 카운트 + idx=1 단서 행 표기 | ✅ 9행 + idx=1 단서 |
| 모듈 스펙 §12-4 신규 검증 항목 10건 본 작업지시서 반영 | ✅ §6-2-3 + §6-3-3 + §10-2-1·2 + §12-2 (N-7)·(N-1) |
| 모듈 스펙 §11-2~5 결정 4건 본 작업지시서 반영 | ✅ §9-4 (selfTest sanity 채택)·(N-17) (Object.freeze 미적용)·§5-4 (HOLDING_PERIOD_BOUNDARY_YEARS 정수만)·(R-5) (UNREGISTERED_RATE 유지) |

### A-8. 차단 사항 — 없음

본 작업지시서 산출 후 Claude Code 실행 진입 가능. 차단 사항 0건.

---

(끝)

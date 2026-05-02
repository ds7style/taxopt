# Code 작업지시서 — TaxOpt v0.3-A (tax_rules.js 패치)

| 항목 | 내용 |
|---|---|
| 작업지시서 ID | 05 (v0.3-A — tax_rules.js 단독) |
| 산출 파일 경로 | `docs/05_code_work_orders/05_tax_rules_v0_3.md` |
| 작성 시점 | 2026-05-02 (작업 창 #12 통합본 산출 → 본 관제탑 분리본 재구성) |
| 대상 코드 | `js/tax_rules.js` v0.2.0 → v0.3-A |
| 패치 본질 | 다주택 중과 가산세율 룩업 + 헬퍼 함수 신규 (HEAVY_TAX_RATE_ADDITION + findHeavyTaxRateAddition) |
| 패턴 계승 | v0.2 작업지시서 03 (1,004줄) 분리 패턴 그대로 |
| 단일 진본 참조 | `docs/v0.3/modules/tax_rules.md` v0.3-A (1,147줄) |
| 명세서 정본 | `docs/v0.3/01_calc_engine_spec.md` v0.3-A §3 (다주택 중과 판정) |
| 호출 베이스라인 | `js/tax_rules.js` v0.2.0 (commit 8612cad) |
| 회귀 베이스라인 | `tests/tax_rules.test.js` v0.2.0 (Node.js 150/0) |
| Claude Code 산출 책임 | `js/tax_rules.js`·`tests/tax_rules.test.js` 2종 |
| 본 작업지시서 비책임 | `.js`·`.test.js` 본문 산출 (의사결정 #9 v9). 본 작업지시서는 코드 골격(시그니처·산식 의사코드) 수준만 명시 |
| 후속 작업지시서 | `docs/05_code_work_orders/06_tax_engine_v0_3.md` (tax_engine.js 패치, 본 작업지시서 완료 후 진입) |
| 분리 사유 | v0.2 분리 패턴 일관성 (의사결정 #11 운영 원칙). 통합본 패턴은 일회성 검토로 분리 채택 |

> **본 작업지시서는 분리본**: `tax_rules.js` 패치만 다룬다. `tax_engine.js` 패치는 **선행 의존성** — 본 작업지시서 회귀 통과 후 작업지시서 06 진입.

---

## §0. 본 작업지시서의 단일 책임

본 작업지시서는 **Claude Code가 단일 .md 1건만 보고 v0.3-A 패치 코드 4종(`js/tax_rules.js`·`js/tax_engine.js`·`tests/tax_rules.test.js`·`tests/tax_engine.test.js`)을 실수 없이 산출**하도록 하는 입력 패키지다.

### §0-1. 의사결정 #5 강화 (법령 개정 대응 아키텍처) 인용 — B-020 적용

본 작업지시서가 지시하는 코드는 다음 3원칙을 준수한다 (모듈 스펙 v0.3-A §0-1·§1-2 직접 인용).

| 원칙 | 본 작업지시서 적용 | v0.3-A 직접 사례 |
|---|---|---|
| (1) **단일 소스** | 가산세율(+20%p, +30%p)은 `tax_rules.js`의 `HEAVY_TAX_RATE_ADDITION` 룩업 단일 보유. `tax_engine.js` 직접 보유 금지. | `tax_engine.js` 단계 9 본문에 `0.20`·`0.30` 숫자 리터럴 등장 금지. `findHeavyTaxRateAddition(houseCount)` 호출만 허용. |
| (2) **룩업 테이블 우선** | 가산세율 표는 법령 본문(제104조 ⑦) 그대로 2행 룩업 테이블. 등차수열 산식(`(houseCount−1) × 0.10`) 금지. | `tax_rules.js`의 `HEAVY_TAX_RATE_ADDITION = [{ houseCount: 2, addition: 0.20 }, { houseCount: 3, addition: 0.30 }]` 2행 보유. |
| (3) **산식 흐름 분리** | `tax_rules.js`는 데이터·룩업 함수만 노출. 13단계 산식 흐름 + 단계 4 장특공 배제 + 단계 9 동적 재계산은 `tax_engine.js` 책임. | `tax_rules.js`에 `isHeavyTaxationApplicable` 같은 조건 평가 함수 보유 금지. `tax_engine.js`에서 단독 보유. |

### §0-2. 의사결정 #11 운영 원칙 적용

본 작업지시서의 핵심 가치는 정확성·완전성. 일정·속도는 운영 가치 없음. Claude Code가 본 작업지시서 실행 중 다음 경우에는 **산출 보류 후 본 관제탑 회신**:

- 본 작업지시서 본문과 모듈 스펙 v0.3-A 사이 불일치
- 본 작업지시서가 명시하지 않은 결정이 필요한 경우
- v0.2 회귀 안전성 보장이 깨질 가능성이 있는 경우
- TC-011~014 검증값이 본 작업지시서 §10-2 명시값과 다를 경우
- selfTest 부트스트랩 가드 2-A가 false negative를 일으키는 경우

### §0-3. 의사결정 #9 v9 준수 (.js 본문 산출 금지)

본 작업지시서는 **`.js`·`.test.js` 코드 본문을 산출하지 않는다**. 본문에 등장하는 코드 골격은 다음 수준에 한한다:

- 함수 시그니처 (입력·출력·예외 명시)
- 산식 의사코드 (절사 위치·룩업 호출 위치 명시)
- JS 구조 단편 (`{ key: value }` 객체 리터럴, `if (조건) throw` 패턴 수준)

완성된 `.js` 파일 산출은 Claude Code 책임. 본 작업지시서는 입력 패키지.

---

---

## §1. 개요

### §1-1. 목적

`js/tax_rules.js` v0.2.0 + `js/tax_engine.js` v0.2.0을 v0.3-A로 패치한다.

본 패치는 **다주택 중과 메커니즘**을 활성화하여, 다음 4단계 조건이 모두 참인 경우 중과 산출세액을 정확히 계산하도록 한다:

1. `caseData.householdHouseCount >= 2` (1세대 보유 주택 수)
2. `caseData.houses[0].saleRegulated === true` (양도시 조정대상지역)
3. `caseData.salePlan.saleDate >= "2026-05-10"` (시행일 후속)
4. `intermediates.is1Se1House === false` (1세대1주택 비과세 미적용)

본 4조건이 모두 참이면:

- **단계 4** (장기보유특별공제) → `longTermDeduction = 0`으로 강제 (소득세법 제95조 ② 단서)
- **단계 9** (세율) → 누진세율 + 가산세율(`+20%p` 또는 `+30%p`) 동적 재계산
- **보유 < 2년 + 중과** → max(단기세율 산출, 중과 누진 산출) 비교 (제104조 ⑦ 본문 단서)

### §1-2. 범위

본 패치는 **순수 추가**(addition-only) 패치다. v0.2 회귀(tax_rules 150건 + tax_engine 534건)는 그대로 통과해야 한다.

### §1-3. 입력 자료 (Claude Code 정독 필수)

| 자료 | 위치 | 정독 영역 |
|---|---|---|
| 모듈 스펙 (rules) | `docs/v0.3/modules/tax_rules.md` v0.3-A | §3-A·§4-A·§9-A·§12 (전 영역 정독) |
| 모듈 스펙 (engine) | `docs/v0.3/modules/tax_engine.md` v0.3-A | §0-1·§4-2-2·§5-2·§5-4·§5-5·§6-A·§8-1·§8-2 (전 영역 정독) |
| 명세서 정본 | `docs/v0.3/01_calc_engine_spec.md` v0.3-A | §3 (다주택 중과 판정 메커니즘) + §6 (issueFlag 카탈로그) + §10 (골든셋) |
| 골든셋 양식 | `docs/v0.3/04_test_cases_manual.xlsx` | TC-011~014 시트 (검증팀 손계산 + 홈택스 모의계산 + Claude 명세서 3자 일치) |
| 호출 베이스라인 (rules) | `js/tax_rules.js` v0.2.0 (commit 8612cad) | 24종 노출 멤버 시그니처 |
| 호출 베이스라인 (engine) | `js/tax_engine.js` v0.2.0 (commit e36cb68) | 20종 노출 멤버 시그니처 + 단계 4·9 본문 |
| 회귀 베이스라인 (rules) | `tests/tax_rules.test.js` v0.2.0 | 150건 회귀 (Node.js 150/0) |
| 회귀 베이스라인 (engine) | `tests/tax_engine.test.js` v0.2.0 | 534건 회귀 (Node.js 534/0 + sanity 6건 ok) |
| v0.2 작업지시서 03 | `docs/05_code_work_orders/03_tax_rules_v0_2.md` | 패턴 계승 (특히 §11 실행 절차) |
| v0.2 작업지시서 04 | `docs/05_code_work_orders/04_tax_engine_v0_2.md` | 패턴 계승 (특히 §10 회귀 테스트 패턴) |
| 의사결정 정본 | `docs/99_decision_log.md` v13 | #5(법령 개정 대응) + #9 v9(작업 창 분담) + #11(운영 원칙) |
| 백로그 정본 | `docs/98_backlog.md` | B-020·B-022·B-023·B-024·B-032·B-033 |

---

---

## §2. 산출 파일 목록

본 작업지시서는 **`js/tax_rules.js` + `tests/tax_rules.test.js` 2종**을 산출한다. `js/tax_engine.js`·`tests/tax_engine.test.js` 산출은 **후속 작업지시서 06**에서 처리.


### §2-1. `js/tax_rules.js` (v0.2.0 → v0.3-A 패치)

| 항목 | 내용 |
|---|---|
| 패치 형태 | 순수 추가 (24종 멤버 시그니처·값 그대로 보존, 신규 2종 추가) |
| 변경 라인 추정 | +60~+100 라인 (룩업 테이블 2행 + 헬퍼 함수 + 자체검증 함수 + selfTest 보강 + 부트스트랩 가드) |
| 신규 노출 멤버 | 2종 — `HEAVY_TAX_RATE_ADDITION`(룩업 테이블) + `findHeavyTaxRateAddition`(헬퍼 함수) |
| 부속 자체검증 함수 | 1종 — `verifyHeavyTaxRateAddition()` (자체검증 카테고리 내부, 노출 멤버 카운트 무영향) |
| selfTest 보강 | 결과 객체에 `heavyTaxAdditionLookups` 필드 추가, sanity 8건 통합 |
| `LAW_REFS` 보강 | 신규 1키 `heavyTaxation` 추가 |
| `RULE_VERSION` 갱신 | `"v0.2.0-post-20260510"` → `"v0.3.0-post-20260510"` (모듈 스펙 §3-6-1 정본) |
| 노출 멤버 합계 | 24 → **26** (v0.1 17 + v0.2 신규 7 + v0.3-A 신규 2) |


### §2-3. tests/ 변경 정책 + 예외 단서 (인계 3 처리)

본 작업지시서는 v0.2 작업지시서 04 §2-3 단서 패턴을 계승한다.

#### §2-3-1. `tests/tax_rules.test.js` 변경 금지 + 예외 단서

**원칙**: v0.2 회귀 150건은 그대로 보존한다. 케이스 삭제·시그니처 변경 금지.

**예외 단서 (1라인 갱신 허용)**:

- (a) `RULE_VERSION` strict-eq 비교 라인 (예: `assert.strictEqual(taxRules.RULE_VERSION, 'v0.2.0-post-20260510')`)이 있으면 `'v0.3.0-post-20260510'`으로 1라인 갱신. 케이스 삭제 금지.
- (b) `RULE_VERSION` 패턴 매칭 라인 (예: `/^v0\./`)이라면 갱신 불요.

**v0.3-A 신규 회귀 테스트 그룹 추가는 가능** (§9 별도 정의).

#### §2-3-2. `tests/tax_engine.test.js` 변경 금지 + 예외 단서

**원칙**: v0.2 회귀 534건은 그대로 보존한다. 케이스 삭제·시그니처 변경 금지.

**예외 단서 (1라인 갱신 허용)**:

- (a) `ENGINE_VERSION` strict-eq 비교 라인이 있으면 `'v0.3.0-A'`로 1라인 갱신.
- (b) v0.2 sanity 6건은 그대로 통과해야 함. v0.3-A는 sanity 추가 (작업지시서 §10에 명시).

**v0.3-A 신규 회귀 테스트 그룹 추가는 가능** (§10 별도 정의).

---

---

## §3. tax_rules.js v0.3-A 변경 (상세)

본 §3은 모듈 스펙 `tax_rules.md` v0.3-A §3-A·§4-A·§8-3·§9-A를 단일 진본으로 인용하여 작성된다. 본 §3과 모듈 스펙이 충돌하면 모듈 스펙이 우선.

### §3-1. v0.1·v0.2 시그니처 보존 (24종)

v0.2.0 노출 24종은 **모두 시그니처·값 그대로 보존**한다. 본 작업지시서는 24종 일괄 표를 모듈 스펙 `tax_rules.md` v0.3-A §2-2 + v0.2.0 §2-2를 그대로 인용하여 단순 옮긴다 (Claude Code는 정독 후 적용).

| 카테고리 | v0.1 (17종) | v0.2 신규 (7종) | v0.3-A 변경 |
|---|---|---|---|
| 메타데이터 (3) | `RULE_VERSION`·`APPLICABLE_SALE_DATE_FROM`·`LAW_REFS` | — | `RULE_VERSION` 문자열 갱신 + `LAW_REFS`에 `heavyTaxation` 키 추가 |
| 금액·세율·임계 (5+3=8) | `BASIC_DEDUCTION_AMOUNT`·`LOCAL_INCOME_TAX_RATE`·`SHORT_TERM_RATE_UNDER_1Y`·`SHORT_TERM_RATE_UNDER_2Y`·`UNREGISTERED_RATE` | `HIGH_VALUE_HOUSE_THRESHOLD`·`NON_TAXABLE_HOLDING_MIN_YEARS`·`NON_TAXABLE_RESIDENCE_MIN_YEARS` | 모두 그대로 |
| 룩업 테이블 (1+3=4) | `PROGRESSIVE_BRACKETS` | `LONG_TERM_DEDUCTION_TABLE_1`·`LONG_TERM_DEDUCTION_TABLE_2_HOLDING`·`LONG_TERM_DEDUCTION_TABLE_2_RESIDENCE` | 모두 그대로 (v0.3-A 신규는 §3-2에서 추가) |
| 임계 배열 (0+1=1) | — | `HOLDING_PERIOD_BOUNDARY_YEARS = [1, 2, 3, 15]` | 그대로 (v0.3-A 신규 임계 추가 없음 — `tax_rules.md` v0.3-A §3-6-4 인용) |
| 헬퍼 함수 (1+2=3) | `findBracket(taxBase)` | `findHoldingRate(holdingYears, table)`·`findResidenceRate(residenceYears, holdingYears, table)` | 모두 그대로 (v0.3-A 신규는 §3-2에서 추가) |
| 자체검증 함수 (4+1=5) | `selfTest`·`verifyProgressiveContinuity`·`verifyBaseTaxAreIntegers`·`verifyMonotonic` | `verifyLongTermLookups` | `selfTest` 본문 보강 (§3-3) + v0.3-A 신규 1종 추가 (§3-2) |
| **합계** | **17** | **7** | **24 → 26** |

> **인계 4 (멤버 수 정확 표기) 처리**: 본 표는 모듈 스펙 `tax_rules.md` v0.3-A §2-2-7 정본을 그대로 옮긴 것. v0.1 17종 + v0.2 신규 7종 = **24종** + v0.3-A 신규 2종 = **26종**.

> **인계 2 (정본 명칭 채택) 처리**: `NON_TAXABLE_HOLDING_MIN_YEARS`·`NON_TAXABLE_RESIDENCE_MIN_YEARS` 정본 명칭 유지. v0.2.1에서 별칭 4종(`EXEMPTION_*_THRESHOLD_*`) 영구 제거됨. 본 작업지시서는 별칭 표기 사용 금지.

### §3-2. v0.3-A 신규 (HEAVY_TAX_RATE_ADDITION + findHeavyTaxRateAddition = 2종)

#### §3-2-1. HEAVY_TAX_RATE_ADDITION (룩업 테이블, 2행)

**근거**: 소득세법 제104조 제7항 본문 + 시행령 제167조의3 ① + 시행령 제167조의10 ①.

**원소 스키마**:

```js
{
  idx:        number,     // 1~2
  houseCount: number,     // 정수 (2 또는 3)
  addition:   number,     // 0.20 또는 0.30
  label:      string,     // "1세대 2주택 중과 +20%p" 등
  lawRefKey:  string      // "heavyTaxation" (LAW_REFS 매핑용)
}
```

**2개 원소 정답값** (모듈 스펙 `tax_rules.md` v0.3-A §3-A-2 그대로):

| idx | houseCount | addition | label | lawRefKey |
|---|---|---|---|---|
| 1 | 2 | 0.20 | "1세대 2주택 중과 +20%p" | "heavyTaxation" |
| 2 | 3 | 0.30 | "1세대 3주택 이상 중과 +30%p" | "heavyTaxation" |

**3주택 이상 클램프**: `houseCount >= 4`인 경우도 `addition = 0.30` 적용. **룩업 함수(`findHeavyTaxRateAddition`)가 클램프를 처리**하며, 본 룩업 테이블은 **2행만 보유**한다 (`houseCount = 4, 5, ...` 행 추가 금지).

**등차수열 산식 금지** (모듈 스펙 §3-A-4 인용):

```js
// 금지 패턴 (§0-1 원칙 (2) 위반)
addition = (houseCount - 1) * 0.10;   // ← 작성하지 말 것
```

**대신**: `findHeavyTaxRateAddition(houseCount)` 호출.

#### §3-2-2. findHeavyTaxRateAddition(houseCount) (헬퍼 함수)

**함수 계약** (모듈 스펙 `tax_rules.md` v0.3-A §4-A 정본):

| 항목 | 내용 |
|---|---|
| 입력 | `houseCount: number` (정수, ≥ 2) |
| 출력 | `addition: number` (`0.20` 또는 `0.30`) |
| 부수효과 | 없음 (순수 함수) |
| 결정성 | 동일 입력 → 동일 출력 |
| 호출 측 | `tax_engine.js` 단계 4·9 (중과 누진세율 적용 시 가산세율 획득) |

**입력 검증** (실패 시 `Error` throw):

| 입력 | 결과 | 사유 |
|---|---|---|
| `houseCount`가 비정수 | throw | `Number.isInteger(houseCount) === false` |
| `houseCount`가 NaN·Infinity·문자열·null·undefined | throw | 타입·유한성 |
| `houseCount < 2` | throw | 호출 측 차단 실패 시 방어선 |

**클램프 정책** (룩업 함수 내부 처리):

| 입력 | 반환값 | 사유 |
|---|---|---|
| `houseCount === 2` | **0.20** | 표 idx=1 |
| `houseCount === 3` | **0.30** | 표 idx=2 |
| `houseCount >= 4` | **0.30** | **클램프**: 4주택 이상도 모두 idx=2 적용 |

**함수 골격** (참고용, 본문 작성은 Claude Code 책임 — 의사결정 #9 v9):

```js
// js/tax_rules.js v0.3-A — 함수 시그니처 (참고 골격)
function findHeavyTaxRateAddition(houseCount) {
  // 입력 검증
  if (typeof houseCount !== 'number' ||
      !Number.isFinite(houseCount) ||
      !Number.isInteger(houseCount) ||
      houseCount < 2) {
    throw new Error(
      'tax_rules.findHeavyTaxRateAddition: houseCount must be integer >= 2, got: ' + houseCount
    );
  }
  // 클램프: 3주택 이상은 모두 +30%p
  var key = houseCount >= 3 ? 3 : 2;
  for (var i = 0; i < HEAVY_TAX_RATE_ADDITION.length; i++) {
    if (HEAVY_TAX_RATE_ADDITION[i].houseCount === key) {
      return HEAVY_TAX_RATE_ADDITION[i].addition;
    }
  }
  throw new Error(
    'tax_rules.findHeavyTaxRateAddition: unreachable (lookup table missing key: ' + key + ')'
  );
}
```

> **본 골격은 참고용**. 실제 `.js` 본문은 Claude Code가 v0.2 코딩 스타일(IIFE·`var` 키워드 등)을 그대로 따라 작성한다.

#### §3-2-3. LAW_REFS 신규 키 추가

| 키 | 값 |
|---|---|
| `heavyTaxation` | `"소득세법 제104조 제7항, 시행령 제167조의3·제167조의10·제167조의11"` |

v0.2 10키는 그대로 보존하고 신규 1키만 추가. 합계 11키.

### §3-3. selfTest sanity 8건 + verifyHeavyTaxRateAddition

#### §3-3-1. selfTest() 본문 보강

**v0.2 selfTest 결과 객체** (그대로 보존):

```js
{
  ok: boolean,
  ruleVersion: string,
  progressiveContinuity: { ok, ... },
  baseTaxAreIntegers: { ok, ... },
  monotonic: { ok, ... },
  longTermLookups: { ok, ... },
  // ... v0.2 기타 필드 그대로
}
```

**v0.3-A 신규 필드 추가** (모듈 스펙 §9-1 정본 인용):

```js
{
  // ... v0.2 그대로 ...
  heavyTaxAdditionLookups: { ok: boolean, sanityResults: object[], throwResults: object[] }
}
```

**ok 합산 로직 갱신**:

v0.2: `ok = continuity.ok && integers.ok && monotonic.ok && longTermLookups.ok` (4건 AND)

v0.3-A: `ok = continuity.ok && integers.ok && monotonic.ok && longTermLookups.ok && heavyTaxAdditionLookups.ok` (5건 AND)

#### §3-3-2. verifyHeavyTaxRateAddition() 자체검증 함수

**검증 항목 1 — sanity 4건** (모듈 스펙 §4-A-4 정본):

| # | 입력 | 기대 출력 | 의의 | 골든셋 매핑 |
|---|---|---|---|---|
| 1 | `findHeavyTaxRateAddition(2)` | `0.20` | 2주택 중과 정확값 | TC-011 회귀 |
| 2 | `findHeavyTaxRateAddition(3)` | `0.30` | 3주택 정확값 | TC-012 회귀 |
| 3 | `findHeavyTaxRateAddition(4)` | `0.30` | 4주택 클램프 | 보강 |
| 4 | `findHeavyTaxRateAddition(10)` | `0.30` | 10주택 클램프 (극단값) | 보강 |

**검증 항목 2 — throw 4건** (selfTest sanity는 핵심 4건만 통합. 작업지시서 §9-2-1 신규 회귀 테스트 그룹에서 9건 전체 검증):

| # | 입력 | 결과 |
|---|---|---|
| 1 | `findHeavyTaxRateAddition(1)` | throw |
| 2 | `findHeavyTaxRateAddition(2.5)` | throw (비정수) |
| 3 | `findHeavyTaxRateAddition(NaN)` | throw |
| 4 | `findHeavyTaxRateAddition("2")` | throw (문자열) |

**합산**: sanity 4건 + throw 4건 = **8건 통합 검증**. 8건 모두 통과 시 `heavyTaxAdditionLookups.ok = true`.

> **본 함수의 카운팅**: 모듈 스펙 §2-2-7 주석 인용 — `verifyHeavyTaxRateAddition`은 자체검증 카테고리 **내부 분화**로 카운트되며, 노출 멤버 합계(26종)에는 영향 없다 (v0.2 `verifyLongTermLookups`도 동일 패턴).

### §3-4. RULE_VERSION 갱신

**변경 전**: `RULE_VERSION = "v0.2.0-post-20260510"`
**변경 후**: `RULE_VERSION = "v0.3.0-post-20260510"`

> **모듈 스펙 §3-6-1 정본 인용**: `"v0.3.0-post-20260510"` 채택. 시스템 프롬프트의 `"v0.3-A-post-20260510"` 표기는 모듈 스펙 정본과 충돌하므로 **모듈 스펙 정본 채택** (정정 1건).

> **회귀 영향**: §2-3-1 (a) 단서 적용 — `tests/tax_rules.test.js`에 strict-eq 비교 라인이 있다면 1라인 갱신. v0.2 commit 8612cad에서 이미 `"v0.2.0-post-20260510"` 갱신된 상태이므로, v0.3-A 패치 시 동일 라인 1줄 갱신.

### §3-5. 부트스트랩 가드 (호출 측 의존)

본 항목은 `tax_engine.js` v0.3-A 부트스트랩 가드 2-A의 의존성 명시. 본 모듈(`tax_rules.js`)은 `HEAVY_TAX_RATE_ADDITION` 배열 + `findHeavyTaxRateAddition` 함수를 누락 없이 노출할 책임을 진다.

**호출 측 가드** (모듈 스펙 `tax_rules.md` §8-3 정본 인용):

```js
[가드 2-A] v0.3-A 신규 멤버 노출 확인 (신규)
  if typeof findHeavyTaxRateAddition !== 'function'
     or not Array.isArray(HEAVY_TAX_RATE_ADDITION)
     → throw 'tax_engine v0.3-A: tax_rules v0.3-A (HEAVY_TAX_RATE_ADDITION 등) 미로드'
```

본 가드는 `tax_engine.js`에 작성되며, 본 모듈은 가드 대상 멤버를 **그대로 노출**할 책임만 진다 (§3-2 처리로 자동 충족).

---

---

> **§5 인용 — 작업지시서 05·06 양쪽 공통 영역**: 본 §5는 두 작업지시서가 동일 본문을 그대로 게재한다. 본 작업지시서(rules)는 §5-1·§5-3 (rules 영역)을 직접 활용하며, §5-2(`tax_engine.js` 노출 21종)는 후속 작업지시서 06에서 활용. 정합성 보장을 위해 §5 본문 전체를 양쪽에 그대로 게재.


## §5. 호출 측 정합성 (인계 4 적용 — 멤버 수 정확 표기)

본 §5는 v0.3-A 패치 후 `tax_engine.js`가 `tax_rules.js`를 어떻게 호출하는지의 정합성을 명시한다.

### §5-1. tax_rules.js 노출 멤버 26종 (정본 명칭, 인계 2)

모듈 스펙 `tax_engine.md` v0.3-A §8-1 정본 인용.

| 카테고리 | v0.1 (17) | v0.2 신규 (7) | v0.3-A 신규 (2) | 합계 |
|---|---|---|---|---|
| 메타데이터 | 3 | 0 | 0 | 3 |
| 금액·세율·임계 | 5 | 3 | 0 | 8 |
| 룩업 테이블 | 1 | 3 | 1 (`HEAVY_TAX_RATE_ADDITION`) | 5 |
| 임계 배열 | 0 | 1 | 0 | 1 |
| 헬퍼 함수 | 1 | 2 | 1 (`findHeavyTaxRateAddition`) | 4 |
| 자체검증 함수 | 4 | 1 | (1 verifyHeavyTaxRateAddition은 자체검증 카테고리 내부 분화) | 5 |
| **합계** | **17** | **7** | **2** | **26** |

> **인계 4 (멤버 수 정확 표기) 처리**: v0.1 17종 + v0.2 신규 7종 = **24종** + v0.3-A 신규 2종 = **26종**. `verifyHeavyTaxRateAddition`은 자체검증 카테고리 내부 분화로 카운트되며, 노출 멤버 합계에는 영향 없음 (v0.2 `verifyLongTermLookups`와 동일 패턴).

### §5-2. tax_engine.js 노출 멤버 21종

모듈 스펙 `tax_engine.md` v0.3-A §0-1 정본 인용.

| 카테고리 | v0.1 (17) | v0.2 신규 (3) | v0.3-A 신규 (1) | 합계 |
|---|---|---|---|---|
| 메타데이터 | 1 | 0 | 0 | 1 |
| 메인 함수 | 1 | 0 | 0 | 1 |
| 입력 검증 | 1 | 0 | 0 | 1 |
| 13단계 함수 | 12 | 0 | 0 | 12 |
| v0.2 신규 보조 | 0 | 3 | 0 | 3 |
| selfTest | 1 | 0 | 0 | 1 |
| collectIssueFlags | 1 | 0 | 0 | 1 |
| v0.3-A 신규 | 0 | 0 | 1 (`isHeavyTaxationApplicable`) | 1 |
| **합계** | **17** | **3** | **1** | **21** |

### §5-3. tax_engine.js → tax_rules.js 사용 항목 (v0.3-A 정본, 19종)

모듈 스펙 `tax_engine.md` v0.3-A §8-1-1·§8-1-2 정본 그대로.

#### §5-3-1. v0.2 계승 17종 (정본 명칭, 별칭 4종 영구 제거)

| 사용 멤버 (정본) | 사용 단계 | 형태 |
|---|---|---|
| `BASIC_DEDUCTION_AMOUNT` | 단계 6 | number |
| `LOCAL_INCOME_TAX_RATE` | 단계 11 | number |
| `SHORT_TERM_RATE_UNDER_1Y` | 단계 9 | number |
| `SHORT_TERM_RATE_UNDER_2Y` | 단계 9 | number |
| `PROGRESSIVE_BRACKETS` | 단계 9 | array |
| `findBracket(taxBase)` | 단계 9 | function |
| `RULE_VERSION` | 결과 톱레벨 | string |
| `APPLICABLE_SALE_DATE_FROM` | 단계 0·5-5 (condition3) | string ("2026-05-10") |
| `LAW_REFS` | 결과 톱레벨 | object (heavyTaxation 키 추가) |
| `HIGH_VALUE_HOUSE_THRESHOLD` | 단계 2·3 | number = 1,200,000,000 |
| `NON_TAXABLE_HOLDING_MIN_YEARS` | 단계 2 | number = 2 |
| `NON_TAXABLE_RESIDENCE_MIN_YEARS` | 단계 2 | number = 2 |
| `LONG_TERM_DEDUCTION_TABLE_1` | 단계 4 (중과 미발동 시) | object[] (13행) |
| `LONG_TERM_DEDUCTION_TABLE_2_HOLDING` | 단계 4 (중과 미발동 시) | object[] (8행) |
| `LONG_TERM_DEDUCTION_TABLE_2_RESIDENCE` | 단계 4 (중과 미발동 시) | object[] (9행) |
| `findHoldingRate(holdingYears, table)` | 단계 4 (중과 미발동 시) | function |
| `findResidenceRate(residenceYears, holdingYears, table)` | 단계 4 (중과 미발동 시) | function |

> **인계 2 처리 (별칭 영구 제거)**: 본 작업지시서는 `EXEMPTION_HOLDING_THRESHOLD_YEARS`·`EXEMPTION_RESIDENCE_THRESHOLD_MONTHS` 등의 별칭을 사용하지 않는다. `tax_engine.js` v0.3-A 코드 본문에 별칭 표기가 등장하면 안 됨.

#### §5-3-2. v0.3-A 신규 의존 2종

| 사용 멤버 | 사용 단계 | 형태 | 비고 |
|---|---|---|---|
| `HEAVY_TAX_RATE_ADDITION` | 단계 4·9 (가산세율 룩업) | array (2행) | 산식 형태 금지 (단일 소스 원칙) |
| `findHeavyTaxRateAddition(houseCount)` | 단계 4·9 | function | 룩업 + 클램프 (≥3 → 0.30, <2 → throw) |

#### §5-3-3. tax_engine.js 직접 보유 금지 항목 (v0.3-A 단일 소스 원칙)

다음은 모두 `tax_rules.js` 정본 데이터이며 `tax_engine.js`는 보유 금지 (§0-1 원칙 (1)·(2)):

- 가산세율 숫자 `0.20`·`0.30` (`HEAVY_TAX_RATE_ADDITION` 룩업 호출만 허용)
- 다주택 임계 `2`·`3` (단, `>= 2` 비교는 `isHeavyTaxationApplicable` condition1 산식 흐름의 일부이므로 산식 흐름으로 허용)
- 중과 시행일 `"2026-05-10"` (`APPLICABLE_SALE_DATE_FROM` 호출만 허용)
- 누진세율표 + 가산세율 합산표 (명세서 §3-4-2 표는 검증 보조용, 코드 보유 금지)
- 중과 baseTax 누적 표 (명세서 §3-4-3 표는 검증 보조용, 코드 보유 금지 — `PROGRESSIVE_BRACKETS` + addition으로 산식 흐름 도출)

> **검증 방법**: Claude Code가 `js/tax_engine.js` 산출 후, 코드 본문에서 다음 패턴을 grep으로 검색하여 검출되면 안 됨:
> - `0\.20|0\.30` (가산세율 숫자 리터럴 — `LOCAL_INCOME_TAX_RATE = 0.1`은 v0.1 정본이므로 별개)
> - `(houseCount\s*-\s*1)\s*\*\s*0\.10` (등차수열 산식)
> - `"2026-05-10"|'2026-05-10'` (시행일 문자열 리터럴)

---

---

## §7. 절사 처리 (B-022 인용, v0.2 그대로)

### §7-1. v0.2 절사 위치 (그대로 보존)

| 단계 | 절사 함수 | 적용 횟수 |
|---|---|---|
| 단계 3 (고가주택 안분) | `Math.floor(taxableGain × allocationRatio)` | 1회 |
| 단계 4 (장특공) | `Math.floor(taxableGain × totalRate)` | 1회 (중과 미발동 시) |
| 단계 9 (세율) | `Math.floor(taxBase × rate)` 또는 `Math.floor(baseTax + ...)` | 1회 |
| 단계 11 (지방소득세) | `Math.floor(calculatedTax × 0.1)` | 1회 |

### §7-2. v0.3-A 신규 절사 위치

| 단계 | 절사 함수 | 적용 횟수 |
|---|---|---|
| **단계 9-A-1 (중과 누진 동적 재계산)** | `Math.floor(baseTax_with_addition + (taxBase − lowerBound) × (marginalRate + addition))` | 1회 |
| **단계 9-A-2 (보유<2년 + 중과 max 비교)** | `Math.floor(taxBase × SHORT_TERM_RATE)` + `Math.floor(...)` (중과 누진 산출) → max | 각각 1회 후 max |

> **B-022 적용**: v0.2 절사 정책 (Math.floor 절사) 그대로 채택. 반올림 사용 금지. v0.3-A 신규 절사 위치도 동일 정책.

> **비율 변수 절사 금지**: `allocationRatio`·`holdingRate`·`residenceRate`·`totalRate`·`addition`·`marginalRate + addition` 등의 **비율 변수는 절사하지 않는다**. 절사는 금액 계산 단계에서만.

---

---

## §9. tests/tax_rules.test.js v0.3-A 변경

### §9-1. v0.2 회귀 150건 그대로 보존 (RULE_VERSION strict-eq 1라인 예외)

§2-3-1 단서 적용. v0.2 회귀 150건 중 다음 1라인은 갱신 가능:

- `RULE_VERSION` strict-eq 비교 라인 → `'v0.2.0-post-20260510'` → `'v0.3.0-post-20260510'`

이 외의 케이스 삭제·시그니처 변경 금지.

### §9-2. v0.3-A 신규 회귀 테스트 그룹 (Claude Code 결정)

다음 그룹은 모듈 스펙 §12-4 + 본 작업지시서 §3-2·§3-3 검증 항목을 기반으로 한다. 정확한 케이스 수는 Claude Code 재량이지만, 다음 항목을 빠짐없이 포함해야 한다.

#### §9-2-1. 그룹 A — HEAVY_TAX_RATE_ADDITION 룩업 검증

```
test('HEAVY_TAX_RATE_ADDITION이 배열이고 length === 2');
test('HEAVY_TAX_RATE_ADDITION[0].houseCount === 2 && addition === 0.20');
test('HEAVY_TAX_RATE_ADDITION[1].houseCount === 3 && addition === 0.30');
test('HEAVY_TAX_RATE_ADDITION[0].lawRefKey === "heavyTaxation"');
test('HEAVY_TAX_RATE_ADDITION[1].lawRefKey === "heavyTaxation"');
test('LAW_REFS.heavyTaxation 존재 (string, 비어있지 않음)');
```

#### §9-2-2. 그룹 B — findHeavyTaxRateAddition 클램프·throw 검증

```
// 클램프 검증 (4건)
test('findHeavyTaxRateAddition(2) === 0.20');
test('findHeavyTaxRateAddition(3) === 0.30');
test('findHeavyTaxRateAddition(4) === 0.30 (4주택 클램프)');
test('findHeavyTaxRateAddition(10) === 0.30 (10주택 극단 클램프)');

// throw 검증 (9건)
test('findHeavyTaxRateAddition(1) throws');
test('findHeavyTaxRateAddition(0) throws');
test('findHeavyTaxRateAddition(-1) throws');
test('findHeavyTaxRateAddition(2.5) throws (비정수)');
test('findHeavyTaxRateAddition(NaN) throws');
test('findHeavyTaxRateAddition(Infinity) throws');
test('findHeavyTaxRateAddition("2") throws (문자열)');
test('findHeavyTaxRateAddition(null) throws');
test('findHeavyTaxRateAddition(undefined) throws');

// 시그니처 검증
test('typeof findHeavyTaxRateAddition === "function"');
```

#### §9-2-3. 그룹 C — selfTest 보강 검증

```
test('selfTest().ok === true (v0.2 6종 + v0.3-A 1종 = 7종 모두 통과 시)');
test('selfTest().heavyTaxAdditionLookups.ok === true');
test('selfTest().heavyTaxAdditionLookups.sanityResults.length === 4 (sanity 4건)');
test('selfTest().heavyTaxAdditionLookups.throwResults.length === 4 (throw 4건)');
test('RULE_VERSION === "v0.3.0-post-20260510"');
```

#### §9-2-4. 그룹 D — v0.2 노출 멤버 24종 회귀 (기존 그룹 흡수, append-only 보장)

```
test('v0.2 노출 24종 멤버 모두 그대로 접근 가능 (PROGRESSIVE_BRACKETS·LONG_TERM_DEDUCTION_TABLE_1 등)');
test('v0.2 selfTest 6종 검증 항목 모두 ok === true');
```

본 그룹은 v0.2 회귀 150건이 보장하지만, v0.3-A 패치 후에도 정합 유지 여부를 명시적으로 추가 검증.

### §9-3. 회귀 테스트 통과 기준

- v0.2 회귀 150건 그대로 통과 (RULE_VERSION strict-eq 1라인 갱신 후)
- v0.3-A 신규 그룹 A·B·C·D 추가 (예상 +20~+30건)
- 합계: **170~180건 / 0건 실패** (실제 케이스 수는 Claude Code 결정)

---

---

> **§11 인용 — 작업지시서 05·06 양쪽 공통 영역**: 본 §11은 두 작업지시서가 동일 본문을 그대로 게재한다. 본 작업지시서(rules)는 §11-1·§11-2 (rules 단계)·§11-3·§11-4·§11-6을 직접 활용. §11-5 (GitHub Pages 라이브 검증) + §11-2 (engine 단계)는 후속 작업지시서 06에서 활용. **선행 의존성**: 본 작업지시서 §11-3 회귀 통과 → 작업지시서 06 진입.


## §11. Claude Code 실행 절차

### §11-1. 사전 준비 (백업·작업 디렉토리)

#### §11-1-1. 백업

```bash
cd C:\users\ds7st\documents\projects\taxopt
git status   # 깨끗한 작업 트리 확인
git pull origin main   # 최신 동기화
git checkout -b v0.3-A   # v0.3-A 브랜치 생성
```

#### §11-1-2. 작업 디렉토리 확인

```bash
ls js/        # tax_rules.js·tax_engine.js 존재 확인 (v0.2.0 commit 8612cad·e36cb68)
ls tests/     # tax_rules.test.js·tax_engine.test.js 존재 확인 (v0.2.0)
ls docs/v0.3/modules/   # tax_rules.md v0.3-A·tax_engine.md v0.3-A 존재 확인
ls docs/v0.3/01_calc_engine_spec.md   # 명세서 v0.3-A
ls docs/v0.3/04_test_cases_manual.xlsx   # 골든셋 양식
```

#### §11-1-3. 모듈 스펙·명세서 정독

본 작업 시작 전 다음 파일을 정독:

1. `docs/v0.3/modules/tax_rules.md` v0.3-A 전 영역 (1,147줄)
2. `docs/v0.3/modules/tax_engine.md` v0.3-A 전 영역 (733줄)
3. `docs/v0.3/01_calc_engine_spec.md` v0.3-A §3 + §6 + §10 (1,157줄 중 핵심)
4. `js/tax_rules.js` v0.2.0 (commit 8612cad) 전체
5. `js/tax_engine.js` v0.2.0 (commit e36cb68) 전체
6. 본 작업지시서 (`docs/05_code_work_orders/05_v0_3_A.md`) 전체

### §11-2. 코드 작성 (단계별)

#### §11-2-1. 단계 1 — `js/tax_rules.js` v0.3-A 패치

순서:

1. v0.2.0 본문 그대로 보존 (24종 멤버 시그니처·값 모두 변경 금지)
2. `RULE_VERSION` 갱신: `"v0.2.0-post-20260510"` → `"v0.3.0-post-20260510"` (§3-4)
3. `LAW_REFS`에 `heavyTaxation` 키 추가 (§3-2-3)
4. `HEAVY_TAX_RATE_ADDITION` 룩업 테이블 정의 (§3-2-1, 2행)
5. `findHeavyTaxRateAddition(houseCount)` 함수 정의 (§3-2-2, 입력 검증 + 클램프)
6. `verifyHeavyTaxRateAddition()` 자체검증 함수 정의 (§3-3-2, sanity 4건 + throw 4건 통합)
7. `selfTest()` 본문 보강 (§3-3-1, `heavyTaxAdditionLookups` 필드 추가, ok 합산 로직 갱신)
8. `window.TaxOpt.taxRules` 노출 객체에 `HEAVY_TAX_RATE_ADDITION` + `findHeavyTaxRateAddition` 추가

#### §11-2-2. 단계 2 — `js/tax_engine.js` v0.3-A 패치

순서:

1. v0.2.0 본문 그대로 보존 (20종 멤버 시그니처 모두 변경 금지)
2. `ENGINE_VERSION` 갱신: `"v0.2.0-post-20260510"` → `"v0.3.0-A"` (§4-7)
3. 부트스트랩 가드 2-A 추가 (§4-8)
4. `isHeavyTaxationApplicable(caseData, intermediates)` 함수 정의 (§4-2)
5. `calculateSingleTransfer` 본체에서 단계 2 완료 후 단계 4 진입 직전에 `intermediates` 재구성 후 `isHeavyTaxationApplicable` 호출
6. 단계 4 본문 변경 (§4-3): 중과 발동 분기 추가 (`longTermDeduction = 0`, `appliedDeductionTable = null`, `heavyRateAddition = findHeavyTaxRateAddition(...)`)
7. 단계 9 본문 변경 (§4-4):
   - 단계 9-A-1: 중과 + 보유 ≥ 2년 → 누진세율 + 가산세율 동적 재계산
   - 단계 9-A-2: 중과 + 보유 < 2년 → max 비교 (단기세율 산출 vs 중과 누진 산출)
8. `result.steps`에 v0.3-A 신규 4종 필드 채움 (§4-5-2)
9. `terminateAt2 = true` 시 v0.3-A 신규 4종 필드 정책 적용 (§4-5-3)
10. `collectIssueFlags` 본문 보강 (§4-6): 신규 5종 + 보조 3종 발동 조건 + 폐기 1종 미발동
11. `selfTest()` 본문 보강: sanity 6건 → 8건 (TC-011·012 추가)
12. `window.TaxOpt.taxEngine` 노출 객체에 `isHeavyTaxationApplicable` 추가

#### §11-2-3. 단계 3 — `tests/tax_rules.test.js` v0.3-A 패치

순서:

1. v0.2 회귀 150건 본문 그대로 보존 (RULE_VERSION strict-eq 1라인 갱신)
2. v0.3-A 신규 그룹 A·B·C·D 추가 (§9-2)

#### §11-2-4. 단계 4 — `tests/tax_engine.test.js` v0.3-A 패치

순서:

1. v0.2 회귀 534건 본문 그대로 보존 (ENGINE_VERSION strict-eq 1라인 갱신)
2. v0.3-A 신규 그룹 A·B·C·D·E·F 추가 (§10-3)

### §11-3. Node.js 회귀 검증

#### §11-3-1. tax_rules.js 회귀

```bash
node tests/tax_rules.test.js
```

**기대 출력**:

- 통과 케이스 수: **170~180 / 0건 실패** (v0.2 150 + v0.3-A 신규 ~30건)
- 실패 시: 본 작업지시서 §3·§9 재정독 후 정정

#### §11-3-2. tax_engine.js 회귀

```bash
node tests/tax_engine.test.js
```

**기대 출력**:

- 통과 케이스 수: **594~634 / 0건 실패** (v0.2 534 + v0.3-A 신규 ~70건)
- sanity 8건 ok (v0.2 6건 + v0.3-A 2건)
- 실패 시: 본 작업지시서 §4·§10 재정독 후 정정

### §11-4. selfTest 호환성 검증 (sanity 8건)

#### §11-4-1. tax_rules selfTest

```js
const result = window.TaxOpt.taxRules.selfTest();
console.log('tax_rules selfTest:', result.ok ? 'ok' : 'FAIL');
console.log('  heavyTaxAdditionLookups:', result.heavyTaxAdditionLookups.ok ? 'ok' : 'FAIL');
```

**기대**: `ok: true` + `heavyTaxAdditionLookups.ok: true`.

#### §11-4-2. tax_engine selfTest

```js
const result = window.TaxOpt.taxEngine.selfTest();
console.log('tax_engine selfTest:', result.ok ? 'ok' : 'FAIL');
console.log('  taxRulesSelfTest:', result.taxRulesSelfTest.ok ? 'ok' : 'FAIL');
console.log('  sanityChecks:', result.sanityChecks.ok ? 'ok' : 'FAIL');
console.log('  sanity 케이스 수:', result.sanityChecks.results.length);  // 기대: 8
```

**기대**: `ok: true` + sanity 8건 모두 통과.

### §11-5. GitHub Pages 라이브 검증 (TC-011~014 4건 totalTax 일치)

#### §11-5-1. 배포 절차

```bash
git add js/tax_rules.js js/tax_engine.js tests/tax_rules.test.js tests/tax_engine.test.js
git commit -m "feat(v0.3-A): 다주택 중과 + saleRegulated 활성 + 단계 4·9 변경

- tax_rules.js: HEAVY_TAX_RATE_ADDITION 룩업 + findHeavyTaxRateAddition 헬퍼 추가
- tax_engine.js: isHeavyTaxationApplicable + 단계 4 장특공 배제 + 단계 9 동적 재계산
- result.steps: isHeavyTaxation·heavyRateAddition·shortTermTax·heavyProgressiveTax 4종 추가
- issueFlag: 25종 활성 (v0.2 18 + 신규 5 + 보조 3 - 폐기 1)
- 부트스트랩 가드 2-A 추가
- TC-011~014 4건 KPI 100% (4자 일치, GitHub Pages 라이브 검증 후 5자 일치)
- v0.2 회귀 안전성 보장 (tax_rules 150건 + tax_engine 534건 그대로 통과)

Closes B-020 (의사결정 #5 강화 적용)
Refs B-022 (절사 v0.2 그대로), B-032 (결과 객체 v0.2 패턴 계승)
Refs B-023·B-024·B-033 (post-MVP 인계, issueFlag로 표시)"
git push origin v0.3-A
```

배포 후 GitHub Pages 라이브 (`https://ds7style.github.io/taxopt/`) 약 2~5분 내 갱신.

#### §11-5-2. 라이브 검증 스크립트 (Chrome DevTools 콘솔)

```js
// TaxOpt v0.3-A 라이브 검증 — TC-011~014 4건 일괄
const cases = [
  { id: 'TC-011', householdHouseCount: 2, saleRegulated: true,  expected: 286_616_000 },
  { id: 'TC-012', householdHouseCount: 3, saleRegulated: true,  expected: 339_141_000 },
  { id: 'TC-013', householdHouseCount: 2, saleRegulated: false, expected: 130_878_000 },
  { id: 'TC-014', householdHouseCount: 3, saleRegulated: false, expected: 130_878_000 }
];

cases.forEach(tc => {
  const caseData = {
    baseYear: 2026,
    householdMembers: 1,
    basicDeductionUsed: 0,
    householdHouseCount: tc.householdHouseCount,
    houses: [{
      id: 'A',
      salePrice:        1_000_000_000,
      acquisitionPrice:   500_000_000,
      necessaryExpense:    20_000_000,
      acquisitionDate: '2014-05-01',
      saleDate:        '2026-05-15',
      saleRegulated:    tc.saleRegulated,
      acquisitionRegulated: false,
      residenceMonths: 0
    }],
    salePlan: {
      saleDate: '2026-05-15',
      candidateHouseIds: ['A']
    }
  };
  
  try {
    const result = window.TaxOpt.taxEngine.calculateSingleTransfer(caseData);
    const totalTax = result.metrics.totalTax;  // v0.2 코드 정본 (캡슐화 패턴, 인계 1)
    const ok = totalTax === tc.expected;
    console.log(`${tc.id}: totalTax=${totalTax.toLocaleString()} (expected: ${tc.expected.toLocaleString()}) ${ok ? '✅' : '❌'}`);
  } catch (e) {
    console.error(`${tc.id}: ${e.message}`);
  }
});
```

**기대**: 4건 모두 ✅. 5자 일치 KPI 100% 달성.

#### §11-5-3. 실패 시 처리

`❌` 발생 시:

1. 콘솔에서 `result.steps` 전체 객체 출력 후 명세서 §3-4-3 표 + 본 작업지시서 §10-2 정답값과 비교
2. 차이 발생 단계 식별 (단계 4 → `longTermDeduction`, 단계 9 → `calculatedTax` 등)
3. 본 작업지시서 §4 본문 + 모듈 스펙 v0.3-A 재정독
4. 코드 정정 후 재배포 → 재검증

### §11-6. git commit + push (최종 머지)

라이브 검증 통과 후:

```bash
git checkout main
git merge v0.3-A   # fast-forward 또는 squash merge (사용자 정책)
git push origin main
git tag v0.3-A
git push origin v0.3-A
```

> **브랜치 정책**: 사용자(Gim)가 v0.3-A 브랜치 운용 정책을 결정. 본 작업지시서는 권장 패턴만 명시.

---

---

## §12. 검증 체크리스트

### §12-1. v0.2 회귀 안전성 (R-1 ~ R-12)

| ID | 검증 항목 | 통과 기준 |
|---|---|---|
| R-1 | tax_rules.js v0.2 24종 멤버 시그니처·값 보존 | 24종 모두 그대로 접근 가능, RULE_VERSION 문자열 갱신만 예외 |
| R-2 | tax_engine.js v0.2 20종 멤버 시그니처 보존 | 20종 모두 그대로 접근 가능, ENGINE_VERSION 문자열 갱신만 예외 |
| R-3 | tax_rules.test.js v0.2 회귀 150건 통과 | RULE_VERSION strict-eq 1라인 갱신 후 150/0 |
| R-4 | tax_engine.test.js v0.2 회귀 534건 통과 | ENGINE_VERSION strict-eq 1라인 갱신 후 534/0 |
| R-5 | TC-001 totalTax === 98,241,000 (v0.1 회귀) | 그대로 통과 |
| R-6 | TC-002 totalTax === 61,050,000 (v0.1 회귀) | 그대로 통과 |
| R-7 | TC-003 totalTax === 0 (v0.1 회귀) | 그대로 통과 |
| R-8 | TC-006 totalTax === 0 (v0.2 회귀) | 그대로 통과 |
| R-9 | TC-007 totalTax === 6,161,100 (v0.2 회귀) | 그대로 통과 |
| R-10 | TC-008 totalTax === 130,878,000 (v0.2 회귀) | 그대로 통과 |
| R-11 | TC-009 totalTax === 1,383,642 (v0.2 회귀) | 그대로 통과 |
| R-12 | TC-010 totalTax === 122,826,000 (v0.2 회귀) | 그대로 통과 |

### §12-2. v0.3-A 신규 안전성 (N-1 ~ N-20)

| ID | 검증 항목 | 통과 기준 |
|---|---|---|
| N-1 | tax_rules.js v0.3-A 신규 멤버 2종 노출 | `HEAVY_TAX_RATE_ADDITION`·`findHeavyTaxRateAddition` 모두 접근 가능 |
| N-2 | tax_engine.js v0.3-A 신규 멤버 1종 노출 | `isHeavyTaxationApplicable` 접근 가능 |
| N-3 | RULE_VERSION === "v0.3.0-post-20260510" | 정확 일치 |
| N-4 | ENGINE_VERSION === "v0.3.0-A" | 정확 일치 |
| N-5 | findHeavyTaxRateAddition(2) === 0.20 | 정확 일치 |
| N-6 | findHeavyTaxRateAddition(3) === 0.30 | 정확 일치 |
| N-7 | findHeavyTaxRateAddition(4) === 0.30 (클램프) | 정확 일치 |
| N-8 | findHeavyTaxRateAddition(1)·(2.5)·(NaN)·("2") 모두 throw | 4건 throw |
| N-9 | 부트스트랩 가드 2-A 동작 | HEAVY_TAX_RATE_ADDITION 미로드 시 throw |
| N-10 | TC-011 totalTax === 286,616,000 | 4자 일치 (검증팀·홈택스·Claude·Node.js) |
| N-11 | TC-012 totalTax === 339,141,000 | 4자 일치 |
| N-12 | TC-013 totalTax === 130,878,000 (TC-008과 동일, 회귀) | 4자 일치 |
| N-13 | TC-014 totalTax === 130,878,000 (TC-008과 동일, 회귀 보강) | 4자 일치 |
| N-14 | result.steps.isHeavyTaxation 채워짐 (boolean) | 모든 케이스에서 true/false 명시 |
| N-15 | result.steps.heavyRateAddition (number/null) 채워짐 | 중과 시 0.20/0.30, 미발동 시 null |
| N-16 | result.steps.shortTermTax·heavyProgressiveTax (number/null) 채워짐 | 보유<2년+중과 시 양쪽, 그 외 null |
| N-17 | issueFlag 25종 활성 카탈로그 (v0.2 18 + 신규 5 + 보조 3 − 폐기 1) | 발동 조건 모두 충족 |
| N-18 | TC-011 HEAVY_TAXATION_APPLIED 발동 (severity: warning) | 발동 |
| N-19 | TC-013·014 OUT_OF_V01_SCOPE_REGULATED_AREA 미발동 (폐기) | 미발동 |
| N-20 | GitHub Pages 라이브 검증 5자 일치 | TC-011~014 4건 모두 ✅ |

### §12-3. 모듈 스펙 v0.3-A 검증 항목 적용

본 §12-1·§12-2는 모듈 스펙 v0.3-A 검증 항목을 모두 흡수한다.

| 모듈 스펙 §X | 본 작업지시서 매핑 |
|---|---|
| `tax_rules.md` §12-3 회귀 안전성 5건 | R-1·R-3 |
| `tax_rules.md` §12-4 신규 안전성 20건 | N-1·N-3·N-5~N-9 |
| `tax_engine.md` §11 보류 항목 6건 | §4-2-1 인자 시그니처 결정 |
| `tax_engine.md` §6-A issueFlag 카탈로그 25종 | N-17·N-18·N-19 |
| `tax_engine.md` §8-2-2 부트스트랩 가드 2-A | N-9 |
| 명세서 §3-4-3 누적 baseTax 표 | N-10 (검증팀 손계산 일치) |
| 명세서 §3-5-2 max 비교 산식 | §10-3-4 그룹 D |

### §12-4. 차단 사항 정리 (체크리스트 미통과 시)

| 미통과 항목 | 차단 영향 | 처리 |
|---|---|---|
| R-1·R-2 v0.2 멤버 시그니처 깨짐 | **즉시 롤백** | v0.2 베이스라인 재정독 후 정정 |
| R-3·R-4 v0.2 회귀 깨짐 | **즉시 정정** | strict-eq 1라인 외 변경 발생 → 코드 본문 재검토 |
| R-5~R-12 v0.1·v0.2 골든셋 깨짐 | **즉시 정정** | 단계 4·9 변경이 중과 미발동 케이스에 영향을 준 것 → §4-3·§4-4 분기 조건 재검토 |
| N-3·N-4 버전 문자열 불일치 | 정정 | 1라인 갱신 |
| N-5~N-8 룩업·throw 동작 불일치 | 정정 | §3-2 본문 재정독 |
| N-10~N-13 TC-011~014 totalTax 불일치 | **명세서·골든셋 재검** | 검증팀 손계산·홈택스 모의계산과 4자 일치 확정값. 본 작업지시서·명세서 v0.3-A·골든셋 양식 모두 정합. 코드 결함 가능성 큼 → §4-4-3·§4-4-4 산식 재정독 |
| N-17~N-19 issueFlag 발동 조건 불일치 | 정정 | §4-6 + 모듈 스펙 §6-A 재정독 |
| N-20 라이브 검증 실패 | 재배포 | §11-5-3 처리 |

---

---

## §13. 변경 이력

| 버전 | 일자 | 변경 |
|---|---|---|
| v0.3-A | 2026-05-02 | **초판. 작업 창 #12 산출.** v0.2 작업지시서 03 (1,004줄) + 04 (1,559줄) 통합 패턴. (1) tax_rules.js v0.2.0 → v0.3-A 패치 (`HEAVY_TAX_RATE_ADDITION` 룩업 + `findHeavyTaxRateAddition` 헬퍼 + selfTest sanity 8건 + `RULE_VERSION` 갱신 + 부트스트랩 가드 2-A 의존 명시). (2) tax_engine.js v0.2.0 → v0.3-A 패치 (`isHeavyTaxationApplicable` 신규 + 단계 4 장특공 배제 + 단계 9 가산세율 동적 재계산 + 보유<2년+중과 max 비교 + result.steps 신규 4종 + issueFlag 25종 + 부트스트랩 가드 2-A + `ENGINE_VERSION` 갱신). (3) 인계 6건 처리 (B-032 v0.2 패턴 계승, 정본 명칭 채택, §2-3 단서 명문화, 멤버 수 26·21 정확 표기, B-033 post-MVP, 시행령 제167조의10·11 단서 미처리). (4) v0.2 회귀 안전성 보장 (tax_rules 150 + tax_engine 534 + 24·20 멤버 + TC-001~010). (5) v0.3-A 신규 검증 (TC-011~014 KPI 100% — 4자 일치, 라이브 검증 후 5자 일치). |

---

---

## §14. 부록 (자체 검증 결과)

### §14-1. 백로그 ID 정합성 검증

본 작업지시서가 처리하는 백로그 ID와 정본 영역의 정합성:

| 백로그 ID | 정본 영역 (docs/98_backlog.md 본문 직접 인용) | 본 작업지시서 처리 |
|---|---|---|
| B-020 | 의사결정 #5 강화 (법령 개정 대응 아키텍처 명문화) | ✅ §0-1 적용 명시 (3원칙 본문 인용 + v0.3-A 직접 사례) |
| B-022 | 양도소득세 정수 처리 (절사 vs 반올림) 정당성 확인 후 산식 정정 | ✅ §7 v0.2 그대로 (Math.floor 절사, v0.3-A 무영향) |
| B-023 | 양도소득세 부칙·경과규정 본격 반영 | ⏳ post-MVP (§4-6-3 issueFlag `HEAVY_TAX_TRANSITION_NOT_HANDLED` info) |
| B-024 | 일시적 2주택 비과세 임계 본격 처리 (시행령 제155조 ①) | ⏳ post-MVP (명세서 §1-4 옵션 (나) 미포함 채택, 본 작업지시서 영향 없음) |
| B-032 | 결과 객체 구조 명세 vs 실제 코드 불일치 | ⏳ v0.3-A 범위 외 (§6 인계 1, v0.2 패턴 계승) |
| B-033 | 조정대상지역 자동 판정 + 행안부 도로명주소 API 연동 | ⏳ post-MVP (§4-6-3 issueFlag `SALE_REGULATED_USER_INPUT` info) |

> "...로 추정" 표기 사용 없음. 모든 백로그 ID는 시스템 프롬프트 [백로그 정본 인용] 영역과 일치.

### §14-2. 모듈 스펙 인용 정합성

본 작업지시서가 인용한 모듈 스펙 v0.3-A 위치와 정합성:

| 본 작업지시서 §X | 모듈 스펙 §Y 정독 후 인용 | 일치 |
|---|---|---|
| §0-1 (법령 개정 대응 아키텍처) | tax_rules.md §1-2 + tax_engine.md §0-1 | ✅ |
| §3-1 (v0.1·v0.2 시그니처 보존 24종) | tax_rules.md §2-2-7 (합계 검산표) | ✅ |
| §3-2-1 (HEAVY_TAX_RATE_ADDITION 룩업) | tax_rules.md §3-A | ✅ |
| §3-2-2 (findHeavyTaxRateAddition 함수 계약) | tax_rules.md §4-A (입력 검증·클램프·sanity) | ✅ |
| §3-3 (selfTest sanity 8건) | tax_rules.md §9-A + §11-2 | ✅ |
| §4-1 (v0.1·v0.2 시그니처 보존 20종) | tax_engine.md §0-1 + §2 | ✅ |
| §4-2 (isHeavyTaxationApplicable 함수 계약) | tax_engine.md §5-5 | ✅ |
| §4-3 (단계 4 변경 — 장특공 배제) | tax_engine.md §5-2 (특히 §5-2-2 함수 계약) | ✅ |
| §4-4 (단계 9 변경 — 동적 재계산 + max 비교) | tax_engine.md §5-4 (특히 §5-4-3·§5-4-4) | ✅ |
| §4-5 (result.steps 신규 4종) | tax_engine.md §4-2-2 | ✅ |
| §4-6 (issueFlag 25종) | tax_engine.md §6-A | ✅ |
| §4-8 (부트스트랩 가드 2-A) | tax_engine.md §8-2-2 + tax_rules.md §8-3 | ✅ |
| §5-3 (tax_rules.js 사용 항목 19종) | tax_engine.md §8-1-1·§8-1-2 | ✅ |
| §6 (결과 객체 v0.2 패턴 계승) | tax_engine.md §0-2 인계 1 + §4-1·§4-2 | ✅ |
| §10-2 (TC-011~014 골든셋) | 명세서 §10-2 + tax_engine.md §10 + 골든셋 04_test_cases_manual.xlsx | ✅ (3자 일치) |

### §14-3. v0.2 회귀 안전성 검증

| 항목 | 본 작업지시서 보장 |
|---|---|
| tax_rules.js v0.2 24종 노출 멤버 시그니처·값 보존 | ✅ §3-1 표 명시 (RULE_VERSION 문자열 갱신만 예외) |
| tax_engine.js v0.2 20종 노출 멤버 시그니처 보존 | ✅ §4-1 표 명시 (ENGINE_VERSION 문자열 갱신만 예외) |
| tax_rules 회귀 150건 보존 | ✅ §9-1 (strict-eq 1라인 갱신 후 그대로 통과) |
| tax_engine 회귀 534건 보존 | ✅ §10-1 (strict-eq 1라인 갱신 후 그대로 통과) |
| TC-001~005 v0.1 회귀 보존 | ✅ §12-1 R-5~R-7 (saleRegulated 미입력 → 자동 보정 false → 중과 미발동 → v0.1 결과 그대로) |
| TC-006~010 v0.2 회귀 보존 | ✅ §12-1 R-8~R-12 (saleRegulated=false 명시 → 중과 미발동 → v0.2 결과 그대로) |

### §14-4. v0.3-A 신규 검증 항목 명시

| 명세서 §X / 모듈 스펙 §Y 검증 항목 | 본 작업지시서 매핑 |
|---|---|
| 명세서 §3-A-2 룩업 테이블 정답값 | §3-2-1 + §9-2-1 (그룹 A) + §12-2 N-1 |
| 명세서 §3-A-3 sanity 보장 | §3-3-2 + §9-2-2·§9-2-3 |
| 명세서 §3-A-4 등차수열 산식 금지 | §3-2-1 + §5-3-3 (grep 검증 항목) |
| 명세서 §4-A-1 입력 검증 throw | §3-2-2 + §9-2-2 (throw 9건) |
| 명세서 §4-A-2 클램프 정책 | §3-2-2 + §9-2-2 |
| 명세서 §3-1 평가 함수 4조건 | §4-2 + §10-3-2 (그룹 B) |
| 명세서 §3-3-1 단계 4 변경 | §4-3 + §10-3-3 (그룹 C) |
| 명세서 §3-4-1 단계 9 산식 + §3-4-3 누적 표 | §4-4-3 + §10-3-4 (그룹 D) + §10-2-1 검증팀 손계산 |
| 명세서 §3-5-2 max 비교 산식 | §4-4-4 + §10-3-4 (그룹 D) |
| 명세서 §3-7 결과 객체 신규 4종 | §4-5-2 + §6-3-2 + §10-3-5 |
| 명세서 §6 issueFlag 25종 카탈로그 | §4-6 + §10-3-6 (그룹 F) |
| 명세서 §10-2 골든셋 TC-011~014 | §10-2 (4건 정답값 명시) + §10-3-5 (그룹 E) |

### §14-5. 자체 발견 짚을 부분 (3건)

본 작업지시서 작성 중 발견한 짚을 부분 3건. Claude Code 실행 또는 본 관제탑 후속 점검 시 추가 확인 필요.

#### §14-5-1. 짚을 부분 1: ENGINE_VERSION 표기 일관성

**현상**: 시스템 프롬프트는 ENGINE_VERSION을 `"v0.3-A-post-20260510"`으로 표기. 모듈 스펙 `tax_engine.md` v0.3-A §0-1-1·§4-1·§10 정본은 `"v0.3.0-A"`로 표기. RULE_VERSION은 `"v0.3.0-post-20260510"`으로 일관.

**본 작업지시서 처리**: 모듈 스펙 정본 채택 (`ENGINE_VERSION = "v0.3.0-A"`, `RULE_VERSION = "v0.3.0-post-20260510"`). 시스템 프롬프트의 `"v0.3-A-post-20260510"`은 모듈 스펙 정본과 충돌하므로 정정 1건.

**Claude Code 실행 시 확인 필요**: ENGINE_VERSION 정확 일치 검증 (§12-2 N-4). 라이브 검증 시 콘솔에서 `window.TaxOpt.taxEngine.ENGINE_VERSION === "v0.3.0-A"` 확인.

#### §14-5-2. 짚을 부분 2: result.metrics vs result.steps 통합 키 카운팅

**현상**: 모듈 스펙 §4-2 result.steps "27종" 카운팅은 v0.2 23종 + v0.3-A 신규 4종. 그러나 v0.2 commit e36cb68 코드는 `result.steps`에 `totalTax`·`netAfterTaxSaleAmount`·`effectiveTaxRate` 등을 추가 캡슐화하여 23종 외 추가 키가 있을 가능성. 정확한 키 수는 v0.2 코드 정본 진본.

**본 작업지시서 처리**: §6-3-1에서 v0.2 23종 명시하되 "v0.2 코드 정본의 정확한 23종 키 + commit e36cb68에서 추가 캡슐화 키가 있을 수 있음. 본 작업지시서는 v0.2 코드를 그대로 계승"으로 명시. Claude Code가 v0.2 코드 정독 후 그대로 옮김.

**Claude Code 실행 시 확인 필요**: §11-1-3 단계 5 (`js/tax_engine.js` v0.2.0 정독)에서 `result.steps` 정확한 키 수 확인. v0.3-A 신규 4종 추가 후 합계 정합성 검증.

#### §14-5-3. 짚을 부분 3: 명세서 §3-5-2 max 비교 시 동률 처리

**현상**: 보유 < 2년 + 중과 케이스에서 `short_term_tax === heavy_progressive_tax`인 경우, 모듈 스펙 §5-4-4의 `appliedRate.chosen` 결정이 명시되지 않음. 본 작업지시서 §4-4-4는 `>=` 비교로 단기세율 우세 처리.

**본 작업지시서 처리**: §4-4-4 산식에서 `if (short_term_tax >= heavy_progressive_tax) chosen = 'short_term'; else chosen = 'heavy_progressive'`로 명시. 동률은 단기세율 우세로 처리 (보다 유리한 표시).

**Claude Code 실행 시 확인 필요**: 동률 케이스가 골든셋 TC-011~014에는 없으나, 향후 v0.3-B 시나리오 엔진 진입 시 동률 케이스 발생 가능. v0.3-A는 본 작업지시서 처리 그대로 적용.

### §14-6. 인용 자료 미비 — 없음

본 작업지시서 작성 중 인용한 자료는 모두 프로젝트 지식에 영속화된 정본 문서이며, 미비 항목 없음.

| 자료 | 위치 | 정독 완료 |
|---|---|---|
| 모듈 스펙 (rules) | docs/v0.3/modules/tax_rules.md v0.3-A | ✅ |
| 모듈 스펙 (engine) | docs/v0.3/modules/tax_engine.md v0.3-A | ✅ |
| 명세서 정본 | docs/v0.3/01_calc_engine_spec.md v0.3-A | ✅ |
| v0.2 작업지시서 03 | docs/05_code_work_orders/03_tax_rules_v0_2.md | ✅ (패턴 계승) |
| v0.2 작업지시서 04 | docs/05_code_work_orders/04_tax_engine_v0_2.md | ✅ (패턴 계승) |
| 의사결정 정본 | docs/99_decision_log.md v13 | ✅ |
| 백로그 정본 | docs/98_backlog.md | ✅ |
| 소득세법 (원문) | docs/소득세법법률제21065호20260102_양도소득세만.pdf | ✅ (제104조 ⑦ 인용) |
| 소득세법 시행령 (원문) | docs/소득세법_시행령대통령령제36129호20260301_양도소득세만.pdf | ✅ (제167조의3·10·11 인용) |

### §14-7. 차단 사항

본 작업지시서 작성 완료. 차단 사항 0건.

후속 작업 (Claude Code 산출 — `js/tax_rules.js` v0.3-A·`js/tax_engine.js` v0.3-A·`tests/*.test.js` v0.3-A) 진입 가능 상태.

---

본 문서는 v0.3-A 명세서·모듈 스펙이 변경되지 않는 한 함께 변경되지 않는다. v0.3-B 시나리오 엔진 진입 시 별도 작업지시서(`docs/05_code_work_orders/06_scenario_engine.md` 등)가 신설되며, 본 작업지시서는 v0.3-A 회귀 보호 단계 진입 후 동결된다.

(끝)

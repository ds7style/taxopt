# TaxOpt — salePlan UI 설계 (작업 창 #2 산출물)

| 항목 | 내용 |
|---|---|
| 문서 ID | `docs/02_saleplan_ui_design.md` |
| 작성 시점 | 2026-04-26 |
| 대상 발표 | 2026-05-07 2차 발표 |
| 작업 창 | #2 (salePlan UI 설계) |
| 적용 대상 파일 | `04_index_input_screen.html`, `js/input-collector.js`(예정) |
| 산출물 | A · B · C · D + 부산물 1, 2 |

---

## 0. 사전 정리

### 0-1. ②.5 카드에 들어갈 입력 필드 목록 (PRD 8-5절 + salePlan 권장 구조 기준)

| # | salePlan 필드 | PRD 8-5절 항목 | 컨트롤 타입 | 라벨 / 힌트 | 기본값 | 의존관계 |
|---|---|---|---|---|---|---|
| 1 | `targetSaleCount` | "그중 몇 채를 양도할 계획인지" | `<select>` | "양도할 주택 수 / 보유 N채 중 몇 채를 매도하실 계획인가요?" | 보유 2채→`1`, 보유 3채→`2` | 카드 ② 보유 주택 수에 따라 옵션 동적 변경 |
| 2 | `allowSystemToChooseSaleTargets` | "매도 대상이 이미 정해져 있는지" | `<select>` (예/아니오) | "매도 대상이 이미 정해져 있나요? / 정해져 있지 않다면 시스템이 후보를 비교합니다" | `true` (시스템에 위임) | `false`일 때 fixedSaleHouseIds 입력 권장 |
| 3 | `fixedSaleHouseIds` | "반드시 팔아야 하는 주택" | 체크박스 그룹 (주택 A·B·C) | "반드시 팔아야 하는 주택 (중복 선택 가능)" | `[]` | 보유 주택 수에 따라 C 체크박스 표시/숨김. excludedHouseIds와 동시 선택 불가 |
| 4 | `excludedHouseIds` | "반드시 보유해야 하는 주택" | 체크박스 그룹 (주택 A·B·C) | "반드시 보유해야 하는 주택 (중복 선택 가능)" | `[]` | 보유 주택 수에 따라 C 체크박스 표시/숨김. fixedSaleHouseIds와 동시 선택 불가 |
| 5 | `allowYearSplitting` | "과세연도 분산을 허용할 것인지" | 단일 체크박스 | "과세연도를 나누어 분산 양도하는 시나리오도 비교" | `false` | targetSaleCount이 `2` 이상 또는 `undecided`일 때만 활성 |
| 6 | `targetSaleYears` | "양도 시점이 고정되어 있는지" | 체크박스 그룹 (2025·2026·2027·2028) | "분산 양도 후보 연도 / 기준연도 포함, 2개 이상 선택" | `[base-year 값]` (예: `[2026]`) | allowYearSplitting=true일 때만 영역 표시. base-year 값은 자동 체크 |
| 7 | `candidateHouseIds` | (보유 주택 수 + 제외 반영) | (UI 입력 없음) | — | 보유 주택 수에서 자동 도출 | 카드 ②의 보유 주택 수 토글 결과로 자동 계산 |

### 0-2. 의존관계 그래프 (한 줄 정리)

- 카드 ②의 보유 주택 수(2/3) → ②.5의 `targetSaleCount` 옵션 + `fixed/excluded` C 체크박스 표시
- `targetSaleCount === 1` → `allowYearSplitting` 비활성(분산 양도가 의미 없음)
- `allowYearSplitting === true` → `targetSaleYears` 영역 표시
- `fixedSaleHouseIds ∩ excludedHouseIds ≠ ∅` → 충돌 경고 배너 표시

---

## 1. 산출물 A — ②.5 "양도 계획" 카드 HTML 블록

기존 `04_index_input_screen.html`에 그대로 끼워 넣을 수 있는 완결된 `<section class="card">` 블록입니다.

### 1-1. 삽입 위치

기존 `<!-- ═══════════════════ 2. 공통 정보 ═══════════════════ -->` 카드(②)의 닫는 `</section>` 바로 뒤, 그리고 `<!-- ═══════════════════ 3. 주택별 입력 폼 ═══════════════════ -->` 카드(③) 시작 직전.

### 1-2. 입출력·예외처리·테스트

- **입력**: 사용자의 클릭/선택. 카드 ②의 `btn-2`/`btn-3` 토글 상태.
- **출력**: 화면 DOM 상태(체크박스, select 값). caseData 변환은 `input-collector.js`의 `collectCaseData()`에서 별도로 처리(이 카드 안에서는 하지 않음).
- **예외처리**: `fixed ∩ excluded ≠ ∅` 동시 선택 시 경고 배너 표시(차단은 하지 않음 — 차단은 `validateCaseData()`에서 처리).
- **테스트 방법**:
  1. 카드 ②의 2채/3채 토글 → C 체크박스 표시·숨김 확인
  2. `targetSaleCount`=1로 변경 → `allowYearSplitting` 체크박스 disabled 확인
  3. `allowYearSplitting` 체크 → 연도 후보 영역 표시 확인
  4. `sp-fixed-a`와 `sp-excluded-a` 동시 체크 → 충돌 경고 표시 확인

### 1-3. HTML 블록

```html
<!-- ═══════════════════ 2.5 양도 계획 ═══════════════════ -->
<section class="card" id="card-sale-plan">
  <div class="card-header">
    <div class="icon">②.5</div>
    <h2>양도 계획</h2>
    <span class="badge">시나리오 입력</span>
  </div>
  <div class="card-body">

    <p style="font-size:12px;color:var(--gray-400);margin-bottom:14px;">
      보유 주택 중 어떤 주택을, 몇 채를, 언제 양도할지 알려 주세요.
      <br/>미정 항목이 있으면 시스템이 후보 시나리오를 자동으로 비교합니다.
    </p>

    <!-- 1) 양도할 주택 수 + 매도 대상 결정 여부 -->
    <div class="form-grid">

      <div class="form-group">
        <label>
          양도할 주택 수<span class="required">*</span>
          <span class="hint" id="sp-target-hint">보유 2채 중 몇 채를 매도?</span>
        </label>
        <select id="sp-target-sale-count">
          <option value="1" selected>1채만 양도</option>
          <option value="2">2채 양도</option>
          <option value="3">전부 양도 (3채)</option>
          <option value="undecided">아직 정하지 않음</option>
        </select>
      </div>

      <div class="form-group">
        <label>
          매도 대상이 이미 정해져 있나요?<span class="required">*</span>
          <span class="hint">미정이면 시스템이 비교</span>
        </label>
        <select id="sp-allow-system-choose">
          <option value="true" selected>아니오 — 시스템이 후보 비교</option>
          <option value="false">예 — 매도 대상이 정해져 있음</option>
        </select>
      </div>

    </div>

    <div class="form-divider"></div>
    <p class="form-section-title">매도/보유 지정 (선택)</p>

    <!-- 2) 반드시 팔아야 하는 주택 -->
    <div class="form-group" style="margin-bottom:14px;">
      <label>반드시 팔아야 하는 주택 <span class="hint">중복 선택 가능</span></label>
      <div id="sp-fixed-house-group" style="display:flex;gap:8px;flex-wrap:wrap;">
        <label class="checkbox-group" data-sp-house="A">
          <input type="checkbox" id="sp-fixed-a" /><span>주택 A</span>
        </label>
        <label class="checkbox-group" data-sp-house="B">
          <input type="checkbox" id="sp-fixed-b" /><span>주택 B</span>
        </label>
        <label class="checkbox-group" data-sp-house="C" style="display:none;">
          <input type="checkbox" id="sp-fixed-c" /><span>주택 C</span>
        </label>
      </div>
    </div>

    <!-- 3) 반드시 보유해야 하는 주택 -->
    <div class="form-group">
      <label>반드시 보유해야 하는 주택 <span class="hint">중복 선택 가능</span></label>
      <div id="sp-excluded-house-group" style="display:flex;gap:8px;flex-wrap:wrap;">
        <label class="checkbox-group" data-sp-house="A">
          <input type="checkbox" id="sp-excluded-a" /><span>주택 A</span>
        </label>
        <label class="checkbox-group" data-sp-house="B">
          <input type="checkbox" id="sp-excluded-b" /><span>주택 B</span>
        </label>
        <label class="checkbox-group" data-sp-house="C" style="display:none;">
          <input type="checkbox" id="sp-excluded-c" /><span>주택 C</span>
        </label>
      </div>
    </div>

    <div class="form-divider"></div>
    <p class="form-section-title">양도 시점</p>

    <!-- 4) 과세연도 분산 허용 -->
    <div class="form-group" style="margin-bottom:12px;">
      <label class="checkbox-group" id="sp-year-splitting-wrap">
        <input type="checkbox" id="sp-allow-year-splitting" />
        <span>과세연도를 나누어 분산 양도하는 시나리오도 비교</span>
      </label>
      <span class="hint" style="margin-top:4px;">
        예: A는 2026년, B는 2027년에 양도하는 경우와 같은 해에 양도하는 경우 비교
      </span>
    </div>

    <!-- 5) 분산 양도 후보 연도 -->
    <div class="form-group" id="sp-year-candidates" style="display:none;">
      <label>분산 양도 후보 연도 <span class="hint">2개 이상 선택</span></label>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <label class="checkbox-group">
          <input type="checkbox" id="sp-year-2025" value="2025" /><span>2025년</span>
        </label>
        <label class="checkbox-group">
          <input type="checkbox" id="sp-year-2026" value="2026" checked /><span>2026년</span>
        </label>
        <label class="checkbox-group">
          <input type="checkbox" id="sp-year-2027" value="2027" /><span>2027년</span>
        </label>
        <label class="checkbox-group">
          <input type="checkbox" id="sp-year-2028" value="2028" /><span>2028년</span>
        </label>
      </div>
    </div>

    <!-- 6) 충돌 경고 배너 (fixed ∩ excluded ≠ ∅) -->
    <div class="warn-banner" id="sp-conflict-warn" style="display:none;margin-top:12px;">
      <em class="warn-icon">⚠️</em>
      <div>
        <strong>지정 충돌</strong>
        <div id="sp-conflict-warn-msg" style="margin-top:2px;"></div>
      </div>
    </div>

  </div><!-- /card-body -->
</section>

<script>
  /**
   * ②.5 양도 계획 카드의 UI 동작 전용 스크립트.
   * - 양도세 계산식, 시나리오 생성 알고리즘은 이 블록에 두지 않는다.
   * - caseData 변환은 input-collector.js의 collectCaseData()에서 별도로 수행한다.
   */
  (function initSalePlanCard() {
    const $ = (id) => document.getElementById(id);

    // 1) 카드 ②의 보유 주택 수 토글 버튼에 동기화 핸들러 부착
    const btn2 = $('btn-2'), btn3 = $('btn-3');
    if (btn2) btn2.addEventListener('click', () => syncByHouseCount(2));
    if (btn3) btn3.addEventListener('click', () => syncByHouseCount(3));

    // 2) 초기 동기화 (카드 ②의 현재 active 토글 기준)
    const initialCount = (btn3 && btn3.classList.contains('active')) ? 3 : 2;
    syncByHouseCount(initialCount);

    // 3) targetSaleCount 변경 시 → allowYearSplitting 활성/비활성
    $('sp-target-sale-count').addEventListener('change', syncByTargetCount);

    // 4) allowYearSplitting 변경 시 → 연도 후보 영역 표시/숨김
    $('sp-allow-year-splitting').addEventListener('change', syncByYearSplitting);

    // 5) fixed/excluded 체크 변경 시 충돌 검증
    ['sp-fixed-a','sp-fixed-b','sp-fixed-c',
     'sp-excluded-a','sp-excluded-b','sp-excluded-c'].forEach(id => {
      const el = $(id);
      if (el) el.addEventListener('change', validateConflict);
    });

    // ── 함수 정의 ───────────────────────────────────────

    function syncByHouseCount(n) {
      // 주택 C 체크박스 표시/숨김
      document.querySelectorAll('[data-sp-house="C"]').forEach(el => {
        el.style.display = (n === 3) ? '' : 'none';
      });
      if (n < 3) {
        $('sp-fixed-c').checked = false;
        $('sp-excluded-c').checked = false;
      }

      // targetSaleCount의 옵션 갱신
      const sel = $('sp-target-sale-count');
      const prev = sel.value;
      sel.innerHTML = '';
      const opts = [['1','1채만 양도']];
      if (n >= 2) opts.push(['2', n === 2 ? '2채 모두 양도' : '2채 양도']);
      if (n >= 3) opts.push(['3','전부 양도 (3채)']);
      opts.push(['undecided','아직 정하지 않음']);
      opts.forEach(([v,t]) => {
        const o = document.createElement('option');
        o.value = v; o.textContent = t;
        sel.appendChild(o);
      });
      const validValues = opts.map(o => o[0]);
      const defaultVal = (n === 2) ? '1' : '2';
      sel.value = validValues.includes(prev) ? prev : defaultVal;

      // 안내 힌트 갱신
      const hint = $('sp-target-hint');
      if (hint) hint.textContent = `보유 ${n}채 중 몇 채를 매도?`;

      syncByTargetCount();
      validateConflict();
    }

    function syncByTargetCount() {
      const v = $('sp-target-sale-count').value;
      const isMulti = (v === '2' || v === '3' || v === 'undecided');
      const ays = $('sp-allow-year-splitting');
      ays.disabled = !isMulti;
      const wrap = $('sp-year-splitting-wrap');
      if (wrap) wrap.style.opacity = isMulti ? '1' : '0.5';
      if (!isMulti) {
        ays.checked = false;
        $('sp-year-candidates').style.display = 'none';
      }
    }

    function syncByYearSplitting() {
      const checked = $('sp-allow-year-splitting').checked;
      $('sp-year-candidates').style.display = checked ? '' : 'none';
    }

    function isVisibleHouse(h) {
      const el = document.querySelector(`#sp-fixed-house-group [data-sp-house="${h}"]`);
      return el && el.style.display !== 'none';
    }

    function validateConflict() {
      const houses = ['A','B','C'].filter(isVisibleHouse);
      const fixed    = houses.filter(h => $('sp-fixed-'    + h.toLowerCase()).checked);
      const excluded = houses.filter(h => $('sp-excluded-' + h.toLowerCase()).checked);
      const conflicts = fixed.filter(h => excluded.includes(h));

      const warn = $('sp-conflict-warn');
      const msg  = $('sp-conflict-warn-msg');
      if (conflicts.length > 0) {
        warn.style.display = '';
        msg.textContent = `주택 ${conflicts.join(', ')}이(가) "반드시 팔" 항목과 "반드시 보유" 항목에 동시에 지정되어 있습니다. 한 쪽만 선택해 주세요.`;
      } else {
        warn.style.display = 'none';
      }
    }
  })();
</script>
```

> 이 블록은 새 CSS 클래스를 만들지 않고 기존 `--blue`, `--gray-*`, `--red`, `--radius`, `.card`, `.card-header`, `.card-body`, `.form-grid`, `.form-group`, `.checkbox-group`, `.toggle-btn`, `.form-section-title`, `.form-divider`, `.warn-banner`, `.hint`, `.required`, `.field-error` 만 재사용합니다.

---

## 2. 산출물 B — salePlan JSON 스키마 확정안

### 2-1. 스키마 정의

| 필드 | 타입 | 허용값 | 기본값 | 필수 | 설명 |
|---|---|---|---|---|---|
| `targetSaleCount` | `number \| string` | `1`, `2`, `3`, `"undecided"` | 보유 2채→`1`, 보유 3채→`2` | 필수 | 양도할 주택 수. `"undecided"`는 시스템이 후보를 비교 |
| `candidateHouseIds` | `string[]` | `["A"]`, `["A","B"]`, `["A","B","C"]` | 보유 주택 수에서 자동 도출 | 필수 | 시나리오 생성 후보 주택 ID. 화면 입력 없음(자동 도출). `excludedHouseIds`를 제외한 결과로 후속 처리 |
| `fixedSaleHouseIds` | `string[]` | `candidateHouseIds`의 부분집합 | `[]` | 선택 | 반드시 매도해야 하는 주택. `excludedHouseIds`와 교집합이 있으면 invalid |
| `excludedHouseIds` | `string[]` | `candidateHouseIds`의 부분집합 | `[]` | 선택 | 반드시 보유해야 하는 주택. `fixedSaleHouseIds`와 교집합이 있으면 invalid |
| `allowSystemToChooseSaleTargets` | `boolean` | `true`, `false` | `true` | 필수 | `false`이면 `fixedSaleHouseIds.length === targetSaleCount`이어야 의미 있음(검증 시 경고) |
| `allowYearSplitting` | `boolean` | `true`, `false` | `false` | 필수 | `targetSaleCount === 1`이면 강제로 `false` |
| `targetSaleYears` | `number[]` | `[2025]`, `[2026]`, … | `[caseData.baseYear]` | 필수 | `allowYearSplitting === false`이면 길이 1, `true`이면 길이 ≥ 2 권장 |

### 2-2. 검증 규칙 (validateSalePlan에서 처리할 항목 목록만 정의 — 구현은 별도 작업창)

| 코드 | 조건 | 처리 |
|---|---|---|
| `SP_E001` | `fixedSaleHouseIds ∩ excludedHouseIds ≠ ∅` | 차단 (issueFlag severity=error) |
| `SP_E002` | `fixedSaleHouseIds.length > targetSaleCount` (targetSaleCount이 숫자일 때) | 차단 |
| `SP_W001` | `allowSystemToChooseSaleTargets === false` AND `fixedSaleHouseIds.length !== targetSaleCount` | 경고 |
| `SP_W002` | `allowYearSplitting === true` AND `targetSaleYears.length < 2` | 경고 |
| `SP_W003` | `targetSaleCount === 1` AND `allowYearSplitting === true` | 경고 (분산 양도 의미 없음) |
| `SP_W004` | `candidateHouseIds.length - excludedHouseIds.length < targetSaleCount` (수치 targetSaleCount일 때) | 경고 (남은 후보 부족) |

### 2-3. PRD 8-5절 7가지 양도 계획 입력 항목과의 매핑 확인

| PRD 8-5절 항목 | salePlan 필드 |
|---|---|
| ① 현재 보유 주택 수 | (카드 ② `btn-2`/`btn-3` → `caseData.houses.length`로 반영, salePlan에는 `candidateHouseIds.length`로 반영) |
| ② 그중 몇 채를 양도할 계획인지 | `targetSaleCount` |
| ③ 매도 대상 주택이 이미 정해져 있는지 | `allowSystemToChooseSaleTargets` |
| ④ 반드시 팔아야 하는 주택 | `fixedSaleHouseIds` |
| ⑤ 반드시 보유해야 하는 주택 | `excludedHouseIds` |
| ⑥ 양도 시점이 고정되어 있는지 | `targetSaleYears` (길이 1=고정, 길이 ≥ 2=비교) |
| ⑦ 과세연도 분산 허용 여부 | `allowYearSplitting` |

✅ 7개 항목 모두 매핑됨.

### 2-4. 예시 인스턴스

```js
// 예 1) 보유 2채, 1채만 양도, 매도 대상 미정 (= 기본 데모 케이스)
{
  targetSaleCount: 1,
  candidateHouseIds: ["A","B"],
  fixedSaleHouseIds: [],
  excludedHouseIds: [],
  allowSystemToChooseSaleTargets: true,
  allowYearSplitting: false,
  targetSaleYears: [2026]
}

// 예 2) 보유 3채, 2채 양도, A는 반드시 보유, 양도 시점 비교 허용
{
  targetSaleCount: 2,
  candidateHouseIds: ["A","B","C"],
  fixedSaleHouseIds: [],
  excludedHouseIds: ["A"],
  allowSystemToChooseSaleTargets: true,
  allowYearSplitting: true,
  targetSaleYears: [2026, 2027]
}

// 예 3) 매도 대상 확정 (B 매도 결정)
{
  targetSaleCount: 1,
  candidateHouseIds: ["A","B","C"],
  fixedSaleHouseIds: ["B"],
  excludedHouseIds: [],
  allowSystemToChooseSaleTargets: false,
  allowYearSplitting: false,
  targetSaleYears: [2026]
}
```

---

## 3. 산출물 C — 화면 입력값 ↔ caseData 매핑표

### 3-1. caseData 최상위 구조

```
caseData = {
  baseYear:           number,
  householdMembers:   number,
  basicDeductionUsed: boolean,
  houses:             House[],
  salePlan:           SalePlan
}
```

### 3-2. 매핑표 (카드 ② 공통)

| 화면 입력 ID | 화면 라벨 | caseData 경로 | 변환 규칙 | 누락 시 처리 |
|---|---|---|---|---|
| `base-year` | 시뮬레이션 기준 연도 | `caseData.baseYear` | `parseInt(value, 10)` | field-error + missing-banner 등재 (필수) |
| `household-members` | 세대원 수 | `caseData.householdMembers` | `parseInt(value, 10)` | field-error + missing-banner 등재 (필수) |
| `basic-deduction-used` | 당해연도 기본공제 사용 여부 | `caseData.basicDeductionUsed` | `"yes" → true`, `"no" → false` | 미선택 불가(select 기본값 `"no"`) |
| `btn-2` / `btn-3` (active) | 보유 주택 수 (토글) | `caseData.houses.length` | active 클래스로 2 또는 3 결정 | 토글 항상 1개는 active이므로 누락 없음 |

### 3-3. 매핑표 (카드 ③ 주택별 — 주택 A. B/C는 동일 패턴)

| 화면 입력 ID | 화면 라벨 | caseData 경로 | 변환 규칙 | 누락 시 처리 |
|---|---|---|---|---|
| `a-nickname` | 주택 별칭 | `houses[0].nickname` | trim한 문자열 | 누락 시 `"주택 A"`로 대체 (선택 항목) |
| `a-location` | 소재지 | `houses[0].location` | trim한 문자열 | field-error + missing-banner 등재 (필수) |
| `a-acq-date` | 취득일 | `houses[0].acquisitionDate` | `"YYYY-MM-DD"` ISO date string 그대로 | field-error + missing-banner 등재 (필수) |
| `a-acq-price` | 취득가액 (원) | `houses[0].acquisitionPrice` | `parseInt(value, 10)` (원 단위 정수) | field-error + missing-banner 등재 (필수) |
| `a-acq-cost` | 필요경비 (원) | `houses[0].necessaryExpense` | `parseInt(value, 10)` (원 단위 정수) | 누락 시 `0`으로 대체 (선택 항목) |
| `a-acq-regulated` | 취득 당시 조정대상지역 | `houses[0].acquisitionRegulated` | `"yes" → true`, `"no" → false` | 미선택 불가(select 기본값 `"no"`) |
| `a-reside-months` | 실거주 기간 (개월) | `houses[0].residenceMonths` | `parseInt(value, 10)` (개월 단위 정수, 단위 변환 없음) | field-error + missing-banner 등재 (필수) |
| `a-living-now` | 현재 이 주택에 거주 중 | `houses[0].livingNow` | checkbox `checked → true / false` | 미체크 시 `false` |
| `a-sale-date` | 양도 예정일 | `houses[0].expectedSaleDate` | `"YYYY-MM-DD"` ISO date string | field-error + missing-banner 등재 (필수) |
| `a-sale-price` | 양도 예정가액 (원) | `houses[0].expectedSalePrice` | `parseInt(value, 10)` (원 단위 정수) | field-error + missing-banner 등재 (필수) |
| `a-sale-regulated` | 양도 시 조정대상지역 | `houses[0].saleRegulated` | `"yes" → true`, `"no" → false` | 미선택 불가(select 기본값 `"no"`) |
| `houses[0].id` | (자동 부여) | `houses[0].id` | 상수 `"A"` | 입력 없음 |

> 주택 B는 `b-*` → `houses[1].*`(id=`"B"`), 주택 C는 `c-*` → `houses[2].*`(id=`"C"`)로 동일하게 매핑. 주택 C는 `btn-3.active === true`일 때만 `houses` 배열에 포함.

### 3-4. 매핑표 (카드 ②.5 양도 계획 — 신규)

| 화면 입력 ID | 화면 라벨 | caseData 경로 | 변환 규칙 | 누락 시 처리 |
|---|---|---|---|---|
| `sp-target-sale-count` | 양도할 주택 수 | `salePlan.targetSaleCount` | `value === "undecided"`이면 문자열 그대로, 그 외는 `parseInt(value, 10)` | 미선택 불가(select 기본값 존재) |
| `sp-allow-system-choose` | 매도 대상이 이미 정해져 있는가 | `salePlan.allowSystemToChooseSaleTargets` | `"true" → true`, `"false" → false` | 미선택 불가 |
| `sp-fixed-a` / `sp-fixed-b` / `sp-fixed-c` | 반드시 팔아야 하는 주택 | `salePlan.fixedSaleHouseIds` | `checked === true`인 것만 `["A","B","C"]`에서 모음. 보유 주택 수가 2이면 C 무시 | 누락 시 `[]` (선택) |
| `sp-excluded-a` / `sp-excluded-b` / `sp-excluded-c` | 반드시 보유해야 하는 주택 | `salePlan.excludedHouseIds` | `checked === true`인 것만 `["A","B","C"]`에서 모음. 보유 주택 수가 2이면 C 무시 | 누락 시 `[]` (선택) |
| `sp-allow-year-splitting` | 과세연도 분산 허용 | `salePlan.allowYearSplitting` | checkbox `checked → true / false` | 미체크 시 `false` |
| `sp-year-2025` … `sp-year-2028` | 분산 양도 후보 연도 | `salePlan.targetSaleYears` | `allowYearSplitting === false`이면 무시하고 `[caseData.baseYear]` 사용. `true`이면 checked인 연도들을 `parseInt`해서 오름차순 배열 | `allowYearSplitting === true`인데 선택 0개 → `[caseData.baseYear]`으로 폴백 + SP_W002 issueFlag |
| (자동 도출) | 후보 주택 ID | `salePlan.candidateHouseIds` | `caseData.houses.map(h => h.id)` | 입력 없음 |

### 3-5. 단위 일관성 점검

- **금액**: 모두 **원 단위 정수**(`parseInt`로 변환). 천 원/만 원 단위 변환 없음.
- **기간**: 거주 기간은 **개월 단위 정수**. 화면도 caseData도 동일 단위 유지.
- **날짜**: 모두 **`"YYYY-MM-DD"` ISO date string**. Date 객체로 변환하지 않음(JSON 직렬화 호환성).
- **연도**: 정수(`number`).

---

## 4. 산출물 D — AI 자동 입력 영역 제거/숨김 처리 방안

### 4-1. 현황 요약

기존 화면에서 AI 자동 입력 관련 자산은 다음과 같습니다.

| 항목 | 위치 | 종류 |
|---|---|---|
| 카드 ① 자연어 입력 `<section class="card">` | `<main>` 안 첫 카드 | HTML 블록 (textarea + 안내문 + 버튼) |
| `<textarea id="nlp-area">` | 카드 ① 안 | DOM 요소 |
| `<button id="btn-ai-extract" onclick="runAiExtract()">` | 카드 ① 안 | DOM 요소 |
| `runAiExtract()` 함수 | `<script>` 안 | JS 함수 |
| `dummyExtract(text)` 함수 | `<script>` 안 | JS 함수 (더미 추출) |
| `fillForm(data)` 함수 | `<script>` 안 | JS 함수 (폼 자동 채움) |
| `REQUIRED_FIELDS` 상수 | `<script>` 안 | JS 상수 |
| `highlightMissing(data)` 함수 | `<script>` 안 | JS 함수 ✅ **유지 필요** |
| `clearFieldError(e)` 함수 | `<script>` 안 | JS 함수 ✅ **유지 필요** |
| `clearErrors()` 함수 | `<script>` 안 | JS 함수 ✅ **유지 필요** |
| `<div id="missing-banner">` | 카드 ① 직후 | DOM 요소 ✅ **유지 필요** |
| `.field-error` CSS 클래스 | `<style>` 안 | CSS ✅ **유지 필요** |
| `.btn-ai`, `.btn-ai .spinner`, `.filled-badge` CSS | `<style>` 안 | CSS (AI 버튼 전용) |
| `.nlp-btn-row`, `#nlp-area`, `.nlp-hint` CSS | `<style>` 안 | CSS (자연어 영역 전용) |

### 4-2. 권장안: 카드 ①을 `display:none`으로 숨김 + AI 호출 함수만 비활성화

**선택 이유**:

1. 데모 시 콘솔에서 `fillForm(dummyExtract("..."))`을 호출해 빠르게 폼을 채우는 용도로는 dummyExtract / fillForm을 살려두는 게 유용 (개발 효율)
2. `highlightMissing` / `clearErrors` / `field-error`는 수동 입력 검증에서 그대로 사용되므로 절대 손대지 않음
3. `missing-banner`는 카드 ① "직후"에 위치하지만 카드 ①을 숨겨도 미입력 검증 시 정상 표시됨 (`runSimulation()` → `highlightMissing(...)` 흐름)
4. 5/7 발표 후 AI 자동 입력 기능을 다시 살릴 가능성이 있다면 되돌리기 쉬움

### 4-3. 구체적 처리 (한 단위 작업으로 묶음)

#### D-1. 카드 ① HTML 블록 숨김

```html
<!-- 변경 전 -->
<section class="card">
  <div class="card-header">...</div>
  <div class="card-body">...</div>
</section>

<!-- 변경 후 -->
<section class="card" id="card-nlp" style="display:none;" aria-hidden="true">
  <div class="card-header">...</div>
  <div class="card-body">...</div>
</section>
```

#### D-2. `runAiExtract` 호출부 비활성화

`<button id="btn-ai-extract" onclick="runAiExtract()">`의 `onclick` 속성을 그대로 두어도 카드가 숨겨져 있으므로 클릭 불가. 추가 조치는 불필요. (혹시 모를 키보드 포커스 차단까지 원하면 `<button … disabled>` 추가)

#### D-3. JS 함수는 유지하되 호출 흐름에서 제거

다음 함수는 **삭제하지 않음**. 데모 시 콘솔에서만 사용:

- `dummyExtract(text)`
- `fillForm(data)`
- `runAiExtract()`

다음 함수와 자산은 **반드시 그대로 유지**:

- `REQUIRED_FIELDS` (수동 입력 검증의 기준 목록)
- `highlightMissing(data)` (이름은 그대로 두되 인자 `data`는 무시되어도 됨 — DOM에서 직접 읽음)
- `clearFieldError(e)`, `clearErrors()`
- `.field-error` CSS, `#missing-banner` HTML 블록

#### D-4. CSS는 유지

`.btn-ai`, `.nlp-btn-row`, `#nlp-area`, `.nlp-hint`, `.filled-badge`는 카드 ① 안에서만 사용됨. 카드 ①이 `display:none`이면 어차피 보이지 않으므로 CSS 자체는 유지(되돌리기 용이성). 5/7 이후 정리 작업에서 일괄 제거 권장.

#### D-5. 검증 체크리스트

- [ ] 카드 ①이 화면에 보이지 않는다.
- [ ] 카드 ② "세대 기본 정보"가 페이지 최상단(헤더 다음) 첫 카드로 보인다.
- [ ] `runSimulation()` 안에서 `highlightMissing({})` 같은 빈 인자로 호출했을 때 missing-banner가 정상적으로 빨간 테두리와 함께 누락 항목을 띄운다.
- [ ] 콘솔에서 `fillForm(dummyExtract("dummy"))` 입력 시 폼이 채워진다 (선택 검증).

### 4-4. 대안

- **대안 1: 완전 제거** — 권장하지 않음. 만일 깨끗한 코드 우선이라면 5/7 발표 직후 별도 작업으로 카드 ①, AI 관련 함수, AI 관련 CSS를 한꺼번에 제거. 단, `highlightMissing`/`clearErrors`/`#missing-banner`/`.field-error`/`REQUIRED_FIELDS`는 절대 제거하지 않는다.
- **대안 2: 버튼만 disabled** — 권장하지 않음. 사용자에게 의미 없는 비활성 버튼만 보여 혼란.

---

## 5. 부산물 1 — 기존 화면이 수집하지만 caseData에는 들어가지 않을 항목

| 화면 입력 ID | 화면 라벨 | 사유 |
|---|---|---|
| `nlp-area` | 자연어 상황 설명 텍스트 | 5/7 데모에서 AI 자동 입력 기능 제외. caseData에 반영하지 않음 |

(이 외에 카드 ②와 ③의 입력값은 모두 caseData에 1:1로 반영됨)

---

## 6. 부산물 2 — caseData에 필요하지만 기존 화면에 없는 항목 (= ②.5 카드의 신규 입력 필드)

| 신규 화면 입력 ID | 화면 라벨 | caseData 경로 | 카드 |
|---|---|---|---|
| `sp-target-sale-count` | 양도할 주택 수 | `salePlan.targetSaleCount` | ②.5 신규 |
| `sp-allow-system-choose` | 매도 대상 결정 여부 | `salePlan.allowSystemToChooseSaleTargets` | ②.5 신규 |
| `sp-fixed-a/b/c` | 반드시 팔아야 하는 주택 | `salePlan.fixedSaleHouseIds` | ②.5 신규 |
| `sp-excluded-a/b/c` | 반드시 보유해야 하는 주택 | `salePlan.excludedHouseIds` | ②.5 신규 |
| `sp-allow-year-splitting` | 과세연도 분산 허용 | `salePlan.allowYearSplitting` | ②.5 신규 |
| `sp-year-2025`/`sp-year-2026`/`sp-year-2027`/`sp-year-2028` | 분산 양도 후보 연도 | `salePlan.targetSaleYears` | ②.5 신규 |
| (자동 도출) | 후보 주택 ID | `salePlan.candidateHouseIds` | UI 입력 없음 (보유 주택 수에서 도출) |

이 7개 라인이 곧 ②.5 카드에 신규로 추가되는 입력 필드입니다 (단순 select·체크박스만 사용).

---

## 7. 다음 작업 창으로의 인계 (참고)

이 문서는 **입력 수집·정규화·UI 영역**에 한정된 산출물입니다. 다음 작업 창에서 진행할 항목은 다음과 같습니다.

| 다음 작업 창 | 다룰 파일 | 주요 산출물 |
|---|---|---|
| #3 input-collector | `js/input-collector.js` | `collectCaseData()`, `validateCaseData()`, `validateSalePlan()` 구현 (검증 코드 SP_E001~SP_W004 포함) |
| #4 tax-rules | `js/tax-rules.js` | 기본세율표, 양도소득 기본공제 250만원, 장특공 표 1·표 2 등 규칙 데이터 |
| #5 tax-engine | `js/tax-engine.js` | `calculateSingleTransfer()` 단일 주택 일반 과세 계산 함수 |
| #6 scenario-engine | `js/scenario-engine.js` | salePlan 기반 `generateSaleTargetCombinations()`, 상태전이 |
| #7 result-renderer | `js/result-renderer.js`, `result.html` | 하드코딩 결과를 `renderScenarioTable(results)` 기반으로 교체 |

---

[작업 창 #2 완료] 산출물 4건 + 부산물 2건 작성 완료. 다음 차단 사항: 없음

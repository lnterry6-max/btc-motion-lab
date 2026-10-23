/** BTC Motion Lab: historical analysis visualisation, no live forecasts. */
'use strict';
const NS = 'http://www.w3.org/2000/svg';
let report = null;
let activeHorizon = '5';
const horizons = ['5', '15', '30', '60'];
const $ = (id) => document.getElementById(id);

function number(value, digits = 2) {
  return Number.isFinite(Number(value)) ? Number(value).toLocaleString('en-US', {
    minimumFractionDigits: digits, maximumFractionDigits: digits,
  }) : '—';
}
function dollars(v, digits = 2) {
  if (!Number.isFinite(Number(v))) return '—';
  return (Number(v) < 0 ? '-$' : '$') + number(Math.abs(Number(v)), digits);
}
function pct(v, digits = 3, sign = false) {
  if (!Number.isFinite(Number(v))) return '—';
  const n = Number(v);
  return (sign && n > 0 ? '+' : '') + number(n, digits) + '%';
}
function dateLabel(iso) {
  const dt = new Date(iso);
  return Number.isNaN(dt.getTime()) ? 'Unavailable' : dt.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  });
}
function shortTime(iso) {
  const dt = new Date(iso);
  return Number.isNaN(dt.getTime()) ? 'Unavailable' : dt.toLocaleString('en-US', {
    month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'UTC',hour12:false,
  }) + ' UTC';
}
function svgElement(name, attributes = {}, text = null) {
  const node = document.createElementNS(NS, name);
  Object.entries(attributes).forEach(([key, val]) => node.setAttribute(key, String(val)));
  if (text !== null) node.textContent = text;
  return node;
}
function line(svg, x1, y1, x2, y2, cls = 'svg-grid') {
  svg.append(svgElement('line', { x1, y1, x2, y2, class: cls }));
}
function label(svg, value, x, y, anchor = 'start') {
  svg.append(svgElement('text', { x, y, 'text-anchor': anchor, class:'svg-label' }, value));
}
function svgCanvas(holder, ariaLabel) {
  const svg = svgElement('svg', { class: 'chart-svg', viewBox: '0 0 680 260',
    preserveAspectRatio:'none', role:'img', 'aria-label':ariaLabel });
  holder.replaceChildren(svg);
  return svg;
}
function createPath(points, xMapper, yMapper) {
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${xMapper(p, i).toFixed(2)} ${yMapper(p, i).toFixed(2)}`).join(' ');
}
function empty(holder, message) {
  holder.replaceChildren();
  const div = document.createElement('div');
  div.className = 'chart-empty'; div.textContent = message;
  holder.append(div);
}
function drawPrice() {
  const points = report?.chart || [];
  if (points.length < 2) return empty($('price-chart'), 'Not enough candles to draw a price chart.');
  const svg = svgCanvas($('price-chart'), 'Bitcoin historical closing prices in US dollars');
  const x0 = 72, y0 = 12, w = 588, h = 214;
  const prices = points.map(p => Number(p.close_usd));
  let min = Math.min(...prices), max = Math.max(...prices);
  const pad = Math.max(1, (max - min) * .17); min -= pad; max += pad;
  const X = (_, i) => x0 + w * i / (points.length - 1);
  const Y = p => y0 + h * (max - Number(p.close_usd)) / (max - min);
  for (let i = 0; i <= 4; i++) {
    const y = y0 + h * i / 4;
    line(svg, x0, y, x0 + w, y);
    label(svg, '$' + number(max - (max-min) * i / 4, 0), x0 - 10, y + 4, 'end');
  }
  for (let i = 0; i < 4; i++) {
    const x = x0 + w * i / 3;
    label(svg, dateLabel(points[Math.round(i * (points.length - 1) / 3)].time).replace(', 202', " '2"), x, 252, i === 0 ? 'start' : i === 3 ? 'end' : 'middle');
  }
  const path = createPath(points, X, Y);
  const defs = svgElement('defs');
  const grad = svgElement('linearGradient', {id:'price-fill',x1:'0',y1:'0',x2:'0',y2:'1'});
  grad.append(svgElement('stop', {offset:'0%','stop-color':'#679eff','stop-opacity':'.24'}));
  grad.append(svgElement('stop', {offset:'100%','stop-color':'#679eff','stop-opacity':'0'}));
  defs.append(grad); svg.append(defs);
  svg.append(svgElement('path', {d: `${path} L${x0+w} ${y0+h} L${x0} ${y0+h} Z`, fill:'url(#price-fill)'}));
  svg.append(svgElement('path', {d:path,stroke:'#83adff','stroke-width':'2.2',fill:'none','stroke-linejoin':'round','stroke-linecap':'round'}));
  svg.append(svgElement('circle', {cx:X(null, points.length-1), cy:Y(points[points.length-1]),r:'4.5',fill:'#83adff',stroke:'#14253b','stroke-width':'2'}));
}
function drawHistogram(distribution) {
  const svg = svgCanvas($('distribution-chart'), 'Observed historical percentage-change frequency distribution');
  const entries = distribution.histogram.bin_centers;
  const counts = distribution.histogram.counts;
  if (!entries?.length || entries.length !== counts?.length) {
    return empty($('distribution-chart'), 'No distribution data.');
  }
  const x0 = 36, y0 = 10, w = 608, h = 206;
  const max = Math.max(1, ...counts);
  const bin = w / entries.length;
  for (let i=0;i<=3;i++) {const y=y0+h*i/3; line(svg,x0,y,x0+w,y);}
  counts.forEach((c,i) => {
    const barh = (c/max)*(h-4);
    const middle = entries[i];
    svg.append(svgElement('rect', {x:x0+i*bin+.65, y:y0+h-barh, width:Math.max(1,bin-1.3),height:Math.max(0,barh),rx:'2',fill:middle>=0?'#77b3da':'#647dba',opacity:middle>=0?'.9':'.62'}));
  });
  const low = Number(entries[0]), high = Number(entries[entries.length-1]);
  if (low < 0 && high > 0) {
    const zero = x0 + w * (-low)/(high-low);
    svg.append(svgElement('line',{x1:zero,x2:zero,y1:y0,y2:y0+h,stroke:'#d6e4fa','stroke-width':'1','stroke-dasharray':'3 5',opacity:'.8'}));
  }
  [0,.25,.5,.75,1].forEach(t=>label(svg,pct(low+(high-low)*t,2,true),x0+w*t,245,t===0?'start':t===1?'end':'middle'));
}
function drawReplay(backtest) {
  const series = backtest.replay || [];
  if (series.length < 2) return empty($('replay-chart'), 'Not enough held-out observations.');
  const svg = svgCanvas($('replay-chart'), 'Historical backtest: model-estimated versus actual percentage changes');
  const x0=66,y0=12,w=594,h=210;
  const all = series.flatMap(d=>[d.actual_pct,d.modeled_pct]);
  const bound = Math.max(.01, ...all.map(x=>Math.abs(x))) * 1.12;
  const X = (_,i)=>x0+w*i/(series.length-1);
  const Y = (p)=>y0+h*(bound-Number(p))/(2*bound);
  for(let i=0;i<=4;i++) {const y=y0+h*i/4;line(svg,x0,y,x0+w,y);label(svg,pct(bound*(1-i/2),2,true),x0-10,y+4,'end');}
  const actual = createPath(series.map(d=>d.actual_pct),(p,i)=>X(p,i),Y);
  const modeled = createPath(series.map(d=>d.modeled_pct),(p,i)=>X(p,i),Y);
  svg.append(svgElement('path',{d:actual,stroke:'#7cddac','stroke-width':'1.45',fill:'none','stroke-linejoin':'round',opacity:'.78'}));
  svg.append(svgElement('path',{d:modeled,stroke:'#7da9fb','stroke-width':'2.2',fill:'none','stroke-linejoin':'round'}));
  label(svg,dateLabel(series[0].time),x0,252);
  label(svg,dateLabel(series[series.length-1].time),x0+w,252,'end');
}
function horizonName(key) { return key === '60' ? '1 hour' : `${key} minutes`; }
function renderCards() {
  const holder = $('horizon-cards'); holder.replaceChildren();
  for (const key of horizons) {
    const d = report.horizons[key].distribution;
    const button = document.createElement('button');
    button.type = 'button';button.className='horizon-card';
    button.setAttribute('aria-pressed',String(key===activeHorizon));
    button.setAttribute('aria-label',`Explore ${horizonName(key)} historical returns`);
    button.innerHTML = `<div class="horizon-top"><span class="horizon-title">${horizonName(key)}</span><span class="horizon-tag">${key}M</span></div>
      <div class="horizon-main">${number(d.median_absolute_percent,3)}<span class="unit">%</span></div>
      <div class="horizon-sub">Median absolute price movement</div>
      <div class="horizon-dollar">≈ ${dollars(d.median_absolute_usd_equivalent)}</div>
      <div class="horizon-divider"></div>
      <div class="horizon-bottom"><span>Past moves up <strong>${pct(d.up_percent,1)}</strong></span><span class="horizon-arrow">↗</span></div>`;
    button.addEventListener('click',()=>selectHorizon(key));
    holder.append(button);
  }
}
function renderTable() {
  const tbody = $('results-body'); tbody.replaceChildren();
  for (const key of horizons) {
    const {backtest:b,distribution:d} = report.horizons[key];
    const row = document.createElement('tr');
    if (b.status !== 'ok') {
      const th=document.createElement('td');th.textContent=horizonName(key);row.append(th);
      const td=document.createElement('td');td.colSpan=5;td.textContent='Insufficient historical data for this model';row.append(td);
    } else {
      const fields=[horizonName(key),number(d.samples,0),pct(b.model_mae_pct_points,4),pct(b.zero_move_baseline_mae_pct_points,4),pct(b.mae_improvement_vs_zero_pct,2,true),`${pct(b.model_direction_accuracy_pct,1)} / ${pct(b.majority_baseline_accuracy_pct,1)}`];
      fields.forEach((value,i)=>{const td=document.createElement('td');td.textContent=value;
        if(i===0)td.className='strong';
        if(i===4)td.className=b.mae_improvement_vs_zero_pct>0?'success':'weak';
        row.append(td);
      });
    }
    tbody.append(row);
  }
}
function selectHorizon(key) {
  if(!report?.horizons?.[key]) return;
  activeHorizon=key;
  document.querySelectorAll('.horizon-card').forEach((node,i)=>node.setAttribute('aria-pressed',String(horizons[i]===key)));
  document.querySelectorAll('.horizon-tab').forEach(node=>{
    const selected=node.dataset.horizon===key;
    node.classList.toggle('selected',selected);
    node.setAttribute('aria-pressed',String(selected));
  });
  const {distribution:d,backtest:b}=report.horizons[key];
  renderDiagnostics(report.horizons[key],b);
  $('percentile-low').textContent=`${pct(d.signed_percentiles.p10,3,true)} / ${dollars(d.signed_usd_equivalent.p10)}`;
  $('median-move').textContent=`${pct(d.median_absolute_percent,3)} / ${dollars(d.median_absolute_usd_equivalent)}`;
  $('percentile-high').textContent=`${pct(d.signed_percentiles.p90,3,true)} / ${dollars(d.signed_usd_equivalent.p90)}`;
  drawHistogram(d);
  if(b.status==='ok') {
    drawReplay(b);
    $('holdout-dates').textContent=`${horizonName(key)} holdout: ${dateLabel(b.holdout_start_utc)}–${dateLabel(b.holdout_end_utc)}. Selected ${b.method} by validation error; scored on later held-out prices. Historical replay only.`;
  } else {
    empty($('replay-chart'),'Insufficient data for a test replay.');
    $('holdout-dates').textContent='Insufficient clean data for this horizon.';
  }
}
function validateReport(data) {
  return data && data.schema_version===1 && data.report_type==='historical_backtest_only' &&
    Array.isArray(data.chart) && data.horizons && horizons.every(k=>
      data.horizons[k]?.distribution?.histogram?.counts && data.horizons[k]?.backtest);
}
function renderQuality(){
  const q=report.quality;
  if(!q)return;
  $('quality-coverage').textContent=pct(q.coverage_percent,2);
  $('quality-missing').textContent=number(q.missing_candles,0)+' / '+number(q.expected_candles,0);
  $('quality-gap').textContent=number(q.longest_missing_gap_minutes,0)+' min';
  $('quality-age').textContent=number(q.latest_candle_age_minutes_at_build,1)+' min';
  const recent=q.source_status==='recent_at_build';
  $('quality-status').textContent=recent?'Recent at report build':'Delayed at report build';
  $('quality-status').dataset.state=recent?'recent':'delayed';
  $('quality-note').textContent=q.data_checks+'. All readings represent the report-build time, not the current browser time.';
}
function renderDiagnostics(h,b){
  if(h.stability){
    const s=h.stability;
    $('stability-older').textContent=pct(s.older_half.median_absolute_pct,3);
    $('stability-newer').textContent=pct(s.newer_half.median_absolute_pct,3);
    $('stability-note').textContent=number(s.older_half.samples,0)+' older and '+number(s.newer_half.samples,0)+' newer observed windows. These returns can overlap.';
  }
  const holder=$('holdout-slices');holder.replaceChildren();
  if(b.status==='ok'&&b.nonoverlapping_holdout_count){
    $('independent-model-error').textContent=pct(b.nonoverlapping_model_mae_pct_points,4);
    $('independent-baseline-error').textContent=pct(b.nonoverlapping_zero_baseline_mae_pct_points,4);
    $('independent-count').textContent=number(b.nonoverlapping_holdout_count,0)+' spaced-out held-out targets.';
    for(const part of b.holdout_slices||[]){
      const card=document.createElement('div');card.className='slice-card';
      const title=document.createElement('strong');title.textContent=dateLabel(part.start_utc)+' – '+dateLabel(part.end_utc);
      const sub=document.createElement('span');sub.textContent='Model '+pct(part.model_mae_pct_points,4)+' · Baseline '+pct(part.zero_baseline_mae_pct_points,4)+' · '+number(part.samples,0)+' windows';
      card.append(title,sub);holder.append(card);
    }
  }else{
    $('independent-model-error').textContent='—';
    $('independent-baseline-error').textContent='—';
    $('independent-count').textContent='Insufficient test data.';
    holder.textContent='No test slices available.';
  }
}
function render() {
  $('dataset-status').innerHTML='<span class="status-dot" aria-hidden="true"></span> Historical report loaded';
  $('report-updated').textContent=shortTime(report.generated_at_utc);
  updateSnapshotAge();
  $('last-price').textContent=dollars(report.latest_observed_close_usd);
  $('last-time').textContent=shortTime(report.data_end_utc);
  renderQuality();renderCards();renderTable();drawPrice();selectHorizon(activeHorizon);
}
function updateSnapshotAge() {
  if (!report?.generated_at_utc) return;
  const builtAt = new Date(report.generated_at_utc).getTime();
  const ageMinutes = Math.max(0, Math.floor((Date.now() - builtAt) / 60000));
  const ageText = ageMinutes < 60
    ? ageMinutes + ' min ago'
    : Math.floor(ageMinutes / 60) + 'h ' + (ageMinutes % 60) + 'm ago';
  $('report-age').textContent = 'Historical snapshot · built ' + ageText;
  const stale = ageMinutes >= 150;
  $('dataset-status').innerHTML = stale
    ? '<span class="status-dot" style="background:#f5ac67" aria-hidden="true"></span> Historical report delayed'
    : '<span class="status-dot" aria-hidden="true"></span> Historical report available';
}
async function loadReport() {
  try {
    const response=await fetch('./data/report.json',{cache:'no-store'});
    if(!response.ok) throw new Error(`Report not published (${response.status})`);
    const parsed=await response.json();
    if(!validateReport(parsed)) throw new Error('Report format is invalid');
    if(report?.generated_at_utc !== parsed.generated_at_utc) {
      report=parsed;
      render();
    }
    updateSnapshotAge();
  } catch(error) {
    console.info('Historical report update unavailable:', error.message);
    if(report) {
      $('dataset-status').innerHTML='<span class="status-dot" style="background:#f5ac67" aria-hidden="true"></span> Snapshot refresh unavailable';
      updateSnapshotAge();
      return;
    }
    $('dataset-status').innerHTML='<span class="status-dot" style="background:#f5ac67" aria-hidden="true"></span> Awaiting first build';
    $('report-updated').textContent='Pending first build';
    $('horizon-cards').replaceChildren();
    const message=document.createElement('div');message.className='loading-card';
    message.textContent='The site will display only valid historical data after a successful report build.';
    $('horizon-cards').append(message);
  }
}
function main() {
  document.querySelectorAll('.horizon-tab').forEach(btn=>btn.addEventListener('click',()=>selectHorizon(btn.dataset.horizon)));
  loadReport();
  setInterval(loadReport, 15 * 60 * 1000);
  setInterval(updateSnapshotAge, 60 * 1000);
  document.addEventListener('visibilitychange', () => {
    if(!document.hidden) loadReport();
  });
}
main();

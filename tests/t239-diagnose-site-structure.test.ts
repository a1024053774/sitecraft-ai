import assert from 'node:assert/strict';
import test from 'node:test';
import {
  extractPageSections,
  extractPlanItems,
  sequenceSimilarity,
  attributeStageSimilarity,
} from '../scripts/diagnose-site-structure.ts';

test('extractPageSections identifies section types, desktop columns (ignoring mobile max-width media), left-right positions, timeline and updates', () => {
  const css = `
    .wrap { max-width: 1200px; margin: 0 auto; }
    .hero-grid { display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(220px, 0.7fr); gap: 32px; }
    .cat-strip { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 24px; }
    .split-sec { display: grid; grid-template-columns: minmax(180px, 0.35fr) minmax(0, 1fr); gap: 32px; }
    .years-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; }
    @media (max-width: 767px) {
      .hero-grid, .cat-strip, .split-sec { grid-template-columns: 1fr; }
      .years-grid { grid-template-columns: repeat(2, 1fr); }
    }
  `;
  const html = `
    <main>
      <div class="wrap">
        <section class="hero">
          <div class="hero-grid">
            <div class="hero-copy">
              <h1>青禾纸包装</h1>
              <p>我们做折叠彩盒、瓦楞运输盒和纸浆模塑内托。</p>
            </div>
            <div class="hero-mark" aria-hidden="true"><span>禾</span></div>
          </div>
        </section>
        <section class="categories">
          <div class="cat-strip">
            <article><h2>折叠彩盒</h2><p>插口盒 / 抽屉盒</p></article>
            <article><h2>瓦楞运输盒</h2><p>飞机盒 / 对口箱</p></article>
            <article><h2>纸浆模塑内托</h2><p>再生纸浆</p></article>
          </div>
        </section>
        <section class="records split-sec">
          <div class="sec-head"><h2>装载记录</h2></div>
          <div class="sec-body">
            <article><h3>烘焙组合</h3><p>独立内袋装食品组合入盒。</p></article>
            <article><h3>日用品配送</h3><p>交付试装白样。</p></article>
          </div>
        </section>
        <section class="history">
          <h2>业务沿革</h2>
          <dl class="years-grid">
            <div><dt>2011 年</dt><dd>开始折叠纸盒订单</dd></div>
            <div><dt>2016 年</dt><dd>增设自动模切工位</dd></div>
            <div><dt>2020 年</dt><dd>增加瓦楞运输盒结构打样</dd></div>
            <div><dt>2023 年</dt><dd>开始纸浆模塑内托配套开发</dd></div>
          </dl>
        </section>
        <section class="updates split-sec">
          <h2>样品动态</h2>
          <dl>
            <div><dt>2026-09-10</dt><dd>样品记录增加内袋外尺寸栏。</dd></div>
            <div><dt>2026-07-24</dt><dd>整理运输盒白样确认记录。</dd></div>
          </dl>
        </section>
      </div>
    </main>
  `;
  const sections = extractPageSections(html, css);
  assert.equal(sections.length, 5);

  assert.equal(sections[0].type, 'hero');
  assert.equal(sections[0].columns, 2);
  assert.equal(sections[0].mediaPosition, 'text-left-media-right');

  assert.equal(sections[1].type, 'catalog');
  assert.equal(sections[1].columns, 3);
  assert.equal(sections[1].mediaPosition, 'multi-col');

  assert.equal(sections[2].type, 'cases');
  assert.equal(sections[2].columns, 2);
  assert.equal(sections[2].mediaPosition, 'title-left-content-right');

  assert.equal(sections[3].type, 'timeline');
  assert.equal(sections[3].columns, 4);
  assert.equal(sections[3].hasTimeline, true);
  assert.equal(sections[3].hasUpdates, false);

  assert.equal(sections[4].type, 'updates');
  assert.equal(sections[4].columns, 2);
  assert.equal(sections[4].mediaPosition, 'title-left-content-right');
  assert.equal(sections[4].hasUpdates, true);
});

test('extractPageSections detects media-left-text-right, compound hero+catalog sections, and wrapper rows', () => {
  const css = `
    .hero-lr { display: grid; grid-template-columns: 1fr 1.2fr; }
    .strip3 { display: grid; grid-template-columns: 1fr 1fr 1fr; }
    .pair { display: grid; grid-template-columns: 1.15fr 1fr; }
  `;
  const html = `
    <main>
      <section class="hero-compound">
        <div class="hero-lr">
          <figure><img data-image-id="img_1" alt="车间现场"></figure>
          <div><h1>忻州重载减速机</h1><p>按图加工箱体与齿轮。</p></div>
        </div>
        <div class="strip3">
          <div><h2>素描观察基础</h2><p>零基础练习</p></div>
          <div><h2>水彩材料入门</h2><p>干湿叠色</p></div>
          <div><h2>城市速写练习</h2><p>街景取舍</p></div>
        </div>
      </section>
      <div class="pair">
        <section><h2>工作室沿革</h2><p>2016 年 起步；2019 年 扩展；2024 年 留档。</p></section>
        <section><h2>团队分工</h2><p>视觉设计与出版编排协作。</p></section>
      </div>
    </main>
  `;
  const sections = extractPageSections(html, css);
  assert.equal(sections[0].type, 'hero');
  assert.equal(sections[0].mediaPosition, 'media-left-text-right');
  assert.equal(sections[1].type, 'catalog');
  assert.equal(sections[1].columns, 3);
  assert.ok(sections.some(s => s.type === 'timeline' && s.hasTimeline));
  assert.ok(sections.some(s => s.type === 'profile'));
});

test('extractPlanItems separates header/footer clauses and maps main outline clauses to semantic types', () => {
  const outline = '页首以字标和三页导航成格，首屏通栏介绍承接范围；首屏下方列三类包装入口；中段依次陈列三项装载记录；装载记录后用紧凑时间线呈现业务沿革；下段按日期倒序单列三条样品动态；页脚以普通文字展示邮箱及待补充电话地址';
  const items = extractPlanItems(outline);
  const mainTypes = items.filter(i => i.role === 'main').map(i => i.type);
  assert.deepEqual(mainTypes, ['hero', 'catalog', 'cases', 'timeline', 'updates']);
  assert.equal(items.at(-1)?.role, 'footer');
});

test('sequenceSimilarity and attributeStageSimilarity distinguish plan-formed vs write-formed convergence', () => {
  assert.equal(sequenceSimilarity(['hero', 'catalog', 'timeline', 'updates'], ['hero', 'catalog', 'timeline', 'updates']), 1);
  assert.equal(sequenceSimilarity(['hero', 'catalog'], ['timeline', 'updates']), 0);

  const planFormed = attributeStageSimilarity([
    { id: 'a', company: 'c1', style: 'darkroom', planTypes: ['hero', 'catalog', 'cases', 'timeline', 'updates'], htmlTypes: ['hero', 'catalog', 'cases', 'timeline', 'updates'], htmlSignatures: ['hero:2:text-left-media-right', 'catalog:3:multi-col', 'cases:2:title-left-content-right', 'timeline:4:multi-col', 'updates:2:title-left-content-right'] },
    { id: 'b', company: 'c2', style: 'darkroom', planTypes: ['hero', 'catalog', 'process', 'timeline', 'updates'], htmlTypes: ['hero', 'catalog', 'process', 'timeline', 'updates'], htmlSignatures: ['hero:2:text-left-media-right', 'catalog:3:multi-col', 'process:2:title-left-content-right', 'timeline:4:multi-col', 'updates:2:title-left-content-right'] },
  ]);
  assert.ok(planFormed.meanPlanTypeSimilarity >= 0.75);
  assert.ok(planFormed.meanHtmlTypeSimilarity >= 0.75);
  assert.equal(planFormed.dominantStage, 'plan-primary-plus-write-layout');
});

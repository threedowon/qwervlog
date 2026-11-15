// Layout is derived from the clip ID, so export, preview and reload agree.
function layoutFor(seed) {
  let state = 2166136261;
  for (const c of String(seed)) state = Math.imul(state ^ c.charCodeAt(0), 16777619) >>> 0;
  const random = () => {
    state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
  const templates = [
    [[48,150,176,132],[308,235,164,154],[290,636,166,125]],
    [[302,146,170,128],[60,226,165,158],[62,638,174,130]],
    [[48,174,174,130],[300,528,168,130],[66,684,170,128]],
    [[298,168,172,129],[58,528,168,132],[294,684,166,125]],
    [[62,146,166,140],[296,240,172,152],[175,655,174,130]],
    [[300,150,172,129],[56,242,170,150],[178,638,170,128]],
    [[166,162,178,134],[50,550,168,128],[300,684,166,125]],
    [[174,164,172,130],[300,540,170,128],[54,685,170,128]]
  ];
  const base = templates[Math.floor(random() * templates.length)];
  return base.map(([x,y,w,h]) => {
    const scale = .96 + random() * .08;
    w = Math.round(w * scale); h = Math.round(h * scale);
    x = Math.max(32, Math.min(508-w, x + Math.round(random()*24-12)));
    y += Math.round(random()*20-10);
    return [x,y,w,h];
  });
}
function clipLayout(clip) { return clip.layout || layoutFor(clip.id); }

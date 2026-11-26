const $ = id => document.getElementById(id);
const els = {
    q: $("q"), where: $("where"), field: $("field"), sort: $("sort"),
    paid: $("paid"), savedOnly: $("savedOnly"), list: $("list"),
    count: $("count"), empty: $("empty"), notice: $("notice"),
    savedCount: $("savedCount")
};

let results =[];
let saved =[];
try { saved = JSON.parse(localStorage.getItem("savedInternships")|| "[]");} catch (e){}
const persist =() => {try { localStorage.setItem("savedInternships", JSON.stringify(saved));} catch (e) {}};

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const stripTags = s => String(s ?? "").replace(/<[^>]*>/g, "");


function showNotice(msg){els.notice.textContent = msg; els.notice.hidden = !msg;}

// Turn one Adzuna job into the shap the pages uses
function normalize(j){
    return{
        id: String(j.id),
        title: stripTags(j.title),
        company: j.company?.display_name || "Company is not listed",
        location: j.location?.display_name || "Location is not listed",
        field: j.category?.label || "Other",
        posted: j.created,
        salaryMin: j.salary_min || 0,
        salaryMax: j.salary_max || 0,
        desc: stripTags(j.description),
        url: j.redirect_url
    };
}


//Fetching data
 async function fetchInternships(what, where) {
    const params = new URLSearchParams({ what, where });

    let res;
    try {
        res = await fetch(`/api/internships?${params}`);
    } catch (e) {
        throw new Error("The server isn't responding. Please try again in a moment.");
    }

    let data = null;
    try { data = await res.json(); } catch(e){}

    if (!res.ok) throw new Error(data?.error ||`The server returned an error (${res.status}). `);
    if (!data || !Array.isArray(data.results)) throw new Error("The server sent an unexpected response.");
    return data.results;
 }

 async function search() {
    showNotice("Loading internships...");
    try{
        const raw = await fetchInternships(els.q.value.trim(), els.where.value.trim());
        results = raw.map(normalize);
        showNotice(results.length ? "": "No internships found for that Search. Try a broader keyword or another city.");
        refreshFields();
    } catch (err) {
        results = [];
        showNotice("Couldn't load listings:" + err.message);
    }
    render();
 }

 //Rebuilding the field dropdown from the categories in the current results
 function refreshFields(){
    const current = els.field.value;
    els.field.length = 1;
    [...new Set(results.map(r => r.field))].sort().forEach(f => els.field.add(new Option(f, f)));
    els.field.value = [...els.field.options].some(o => o.value === current) ? current : "";
 }

 function ago(dateStr){
    const d = Math.floor ((new Date() - new Date(dateStr)) / 86400000);
    return d <= 0 ? "Posted today" : d === 1 ? "Posted yesterday" : `Posted ${d} days ago`;
 }
 function money(i){
    if (!i.salaryMin) return "";
    const f = n => Math.round(n).toLocaleString();
    return i.salaryMax && i.salaryMax !== i.salaryMin
        ? `${f(i.salaryMin)} - ${f(i.salaryMax)} / year`
        : `${f(i.salaryMin)} / year`;
 }

 function render(){
    let items = els.savedOnly.checked ? [...saved] : [...results];
    items = items.filter(i =>
        (!els.field.value || i.field === els.field.value) &&
        (!els.paid.checked || i.salaryMin > 0)
    );
    items.sort((a,b) => els.sort.value === "salary"
        ?b.salaryMin - a.salaryMin
        : new Date(b.posted) - new Date(a.posted));
    
    els.savedCount.textContent = saved.length;
    els.count.textContent = items.length + (items.length === 1 ? " internship" : " internships");
    els.empty.hidden = items.length > 0 || !els.notice.hidden;

    els.list.innerHTML = items.map(i => {
        const isSaved = saved.some(s => s.id === i.id);
        const pay = money(i);
        return`<li class="item">
            <div>
                <h2>${esc(i.title)}</h2>
                <p class="company">${esc(i.company)}</p>
            </div>
            <ul class="meta">
                <li>${esc(i.field)}</li><li>${esc(i.location)}</li>
                ${pay ? `<li class="paid">${esc(pay)}</li>` : ""}
            </ul>
            <p class="desc">${esc(i.desc)}</p>
            <div class="actions">
                <a class="apply" href="${esc(i.url)}" target="_blank" rel="noopener">Apply</a>
                <button class="save" data-id="${esc(i.id)}" aria-pressed="${isSaved}">${isSaved ? "Saved" : "Save"}</button>
                <span class="deadline">${ago(i.posted)}</span>
            </div>
        </li>`;
    }).join("");
 }

 // Events
 $("searchForm").addEventListener("submit", e => { e.preventDefault(); search();});
 ["field", "sort", "paid", "savedOnly"].forEach(k => els[k].addEventListener("change",render));

 $("reset").addEventListener("click",() =>{
    els.q.value = ""; els.where.value = ""; els.field.value = "";
    els.paid.checked = false; els.savedOnly.checked = false; els.sort.value = "newest";
    search();
 });

 els.list.addEventListener("click", e => {
    const btn = e.target.closest(".save");
    if (!btn) return;
    const id = btn.dataset.id;
    if(saved.some(s => s.id ===id)) saved = saved.filter(s => s.id !== id);
    else {
        const item = results.find(r => r.id ===id);
        if(item) saved.push(item);
    }
    persist();
    render();
 });
 search();
// komachi filter for chrome by H.Shirouzu
$ = function(id) { return document.getElementById(id); }
var kf_opt = {};
kf_opt.no_full_check = 0;
kf_opt.cache_max     = 10000;
kf_opt.cache_min     = 9000;
kf_opt.debug         = 0;
kf_opt.count         = -1;
kf_opt.cache_ctrl    = 0;
kf_opt.vote1_check   = 1;
kf_opt.vote2_check   = 1;
kf_opt.vote3_check   = 1;
kf_opt.vote1_color   = "red";
kf_opt.vote2_color   = "deepskyblue";
kf_opt.vote3_color   = "lime";

function kf_vote_convert(opt) {
    if (opt.vote_check && !opt.vote1_check) {
        opt.vote1_check = opt.vote2_check = opt.vote2_check = 1;
        opt.vote_check = 0;
        return  true;
    }
    return false;
}

function kf_load(cb) {
    chrome.storage.local.get("kf_opt", function(res) {
        var need_store = true;

        if (res.kf_opt !== undefined) {
            need_store = false;
            for (k in kf_opt) {
                if (res.kf_opt[k] === undefined) {
                    res.kf_opt[k] = kf_opt[k];
                    need_store = true;
                }
            }
            kf_opt = res.kf_opt;
            need_store = kf_vote_convert(kf_opt);
        }
        if (need_store) chrome.storage.local.set({"kf_opt": kf_opt});
        cb();
    });
}
function kf_save(cb) {
    chrome.storage.local.set({"kf_opt": kf_opt}, cb);
}

function cache_info_core() {
    if (kf_opt.count >= 0) {
        $("cache_num").value = kf_opt.count;
        kf_opt.count = -1;
        kf_save();
    }
    $("cache_del").disabled = ($("cache_num").value > 0) ? false : true;
}

function check_win(w, cb) {
    var count=0;
    var f = function() {
        try {
            if (!w.closed && count < 50) {
                count++;
                setTimeout(f, 100);
                return; 
            }
        } catch(e) { alert(e); }
        cb();
    };
    setTimeout(f, 100);
}

function cache_ctrl(ctr_no) {
    kf_opt.cache_ctrl = ctr_no;
    kf_save(function() {
        var w = window.open("http://komachi.yomiuri.co.jp/help/policy.htm");
        check_win(w, function() {
            kf_load(kf_init);
        });
    });
}

function cache_info() {
    cache_ctrl(1);
}

function cache_del() {
    if (confirm("キャッシュを削除しますか？")) cache_ctrl(2);
}

function no_full_check() {
    kf_opt.no_full_check = $("no_full_check").checked ? 1 : 0;
    kf_save();
}

function check_item(key) {
    kf_opt[key] = $(key).checked ? 1 : 0;
    kf_save();
}

function vote_color(key) {
    try {
        var color = $(key).value;
        $(key).style.color = color;
        kf_opt[key] = color;
        kf_save();
    }
    catch(e) {
    }
}

function init_check_item(key)
{
    $(key).onclick = function() { return check_item(key); }
    $(key).checked = kf_opt[key];
}

function init_vote_items(key) {
    var chk_key = key + "_check";
    var col_key = key + "_color";

    init_check_item(chk_key);
    $(col_key).onchange = function() { return vote_color(col_key); }
    $(col_key).value = kf_opt[col_key];
    $(col_key).style.color = kf_opt[col_key];
}

function kf_init() {
    $("no_full_check").checked = kf_opt.no_full_check ? true : false;
    init_check_item("no_full_check");
    init_vote_items("vote1");
    init_vote_items("vote2");
    init_vote_items("vote3");

    $("cache_info").onclick = cache_info;
    $("cache_del").onclick  = cache_del;

    cache_info_core();
}

window.onload = function() {
    kf_load(kf_init);
}


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
    if (opt.vote_check == 1 && !opt.vote1_check) {
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

var kf_prefix      = "kf_";
var kf_mode_init   = 0;
var kf_mode_read   = 1;
var kf_mode_update = 2;

$ = function(id) { return document.getElementById(id); }

function kf_cache_clear()
{
    for (var id in localStorage) {
        if (id.substr(0, 3) == kf_prefix) localStorage.removeItem(id);
    }
    localStorage.kf_count = 0;
}

function kf_get_topic_id(url)
{
    var topic_id = url.match(/[0-9]+\.htm/i)[0];
    topic_id = topic_id.slice(0, -4);
    return  topic_id;
}

function kf_load_cache(topic_id)
{
    var kf_topic_id = kf_prefix + topic_id;
    var cached      = localStorage[kf_topic_id];
    if (!cached) return null;

    cached = cached.split('/');
    return { epoch:     cached[0],
             topic_id:  cached[1],
             res_num:   cached[2],
             owner_num: cached[3],
             read_mode: cached[4],
             vote:      cached.length >= 6 ? eval(cached[5]) : [0,0,0,0,0] };
}

function kf_cache_fmt(topic_id, res_num, owner_num, epoch, read_mode, vote)
{
    return  epoch + "/" + topic_id + "/" + res_num + "/" + owner_num + "/" + read_mode + "/[" + vote + "]";
}

function kf_store_cache(topic_id, res_num, owner_num, read_mode, vote)
{
    var kf_topic_id = kf_prefix + topic_id;
    var res         = kf_load_cache(topic_id);
    var epoch       = Math.floor(new Date());

    if (!res) {
        var kf_count = localStorage.kf_count ? Number(localStorage.kf_count) : 0;
        if (kf_count > localStorage.length) kf_count = localStorage.length;

        if (kf_count >= kf_opt.cache_max) {
            console.log("start to reduce kf_count=%d LS=%d", kf_count, localStorage.length);
            var targ = [];
            for (var id in localStorage) {
                var ids = id.split("_");
                if (ids.length == 2 && ids[0] == 'kf' && isFinite(ids[1])) {
                    if (localStorage[id]) {
                        targ.push(localStorage[id]);
                    } else {
                        localStorage.removeItem(id);
                        kf_count--;
                    }
                }
            }
            targ.sort();
            targ.reverse();
            for (var i=kf_count-1; i >= kf_opt.cache_min; i--) {
                var d = targ[i].split("/")
                if (d.length >= 5) {
                    localStorage.removeItem(kf_prefix + d[1]);
                    // console.log("removeItem=%s", d[1]);
                    kf_count--;
                }
            }
            console.log("end to reduce kf_count=%d LS=%d", kf_count, localStorage.length);
        }
        localStorage.kf_count = kf_count + 1;
    }
    else {
        if (read_mode != kf_mode_read) {
            if (owner_num == 0 && res.owner_num > 0) owner_num = res.owner_num;
            if (owner_num > res.owner_num && res.read_mode == kf_mode_read) {
                read_mode = kf_mode_update;
            }
            else if (read_mode == kf_mode_init && res.read_mode != kf_mode_init) {
                read_mode = res.read_mode;
            }
        }
        if (res.vote && !vote) vote = res.vote;
    }
    if (res_num == -1) res_num = (res && res.res_num) ? res.res_num : owner_num;

    localStorage[kf_topic_id] = kf_cache_fmt(topic_id, res_num, owner_num, epoch, read_mode, vote);
    //console.log("kf_store_cache(%s) %s", topic_id, localStorage[kf_topic_id]);
    return  read_mode;
}

function kf_store_cache_ex(doc, topic_id, read_mode, vote)
{
    var res_content = doc.getElementsByClassName("reslisttitle")[0].textContent;
    var owner_only  = res_content.match(/トピ主のレスのみ/);
    var res_match   = res_content.match(/レス数：[0-9]+本/);
    var owner_match = res_content.match(/トピ主のみ\([0-9]+\)/);
    var res_num     = owner_only ? "-1" : res_match ? res_match[0].slice(4, -1) : "0";
    var owner_num   = owner_match ? owner_match[0].slice(6, -1) : "0";

    read_mode = kf_store_cache(topic_id, res_num, owner_num, read_mode, vote);

    return  { res_num: res_num, owner_num: owner_num, read_mode: read_mode, vote: vote };
}

function kf_is_vote_check() {
    return kf_opt.vote1_check || kf_opt.vote2_check || kf_opt.vote2_check;
}

function kf_make_label(node, cached, res, vote, href) {
    var label = " - ";

    if (cached) {
        label = cached.owner_num;

        if (res && kf_opt.trans_check) label += "x";
        if (cached.read_mode == kf_mode_update) {
            label += "!";
        } else if (cached.read_mode == kf_mode_read) {
            label += "-";
        }
        else label += " ";

        if (cached.owner_num >= 20) {
            if (cached.owner_num <= 60) href += "&p=0";
            else                       {
                 href += "&p=" + Math.floor((Number(cached.owner_num) + 19) / 20);
            }
        }
        if (kf_is_vote_check() && vote && vote.length >= 5) {
            var is_read = cached.read_mode >= kf_mode_read;
            // 0:面白い, 1:びっくり, 2:涙, 3:エール, 4:なるほど
            var full_vote = vote[0] + vote[1] + vote[2] + vote[3] + vote[4];
            if (full_vote >= 100) {
                if        (kf_opt.vote1_check && (vote[1] * 10 / full_vote) >= 8) {
                    node.style.color = kf_opt.vote1_color;
                    //if (full_vote >= 8000) node.style.fontWeight = "bold";
                } else if (kf_opt.vote2_check && ((vote[0] + vote[4]) * 10 / full_vote) >= 8) {
                    node.style.color = kf_opt.vote2_color;
                    //if (full_vote >= 5000) node.style.fontWeight = "bold";
                } else if (kf_opt.vote3_check && ((vote[2] + vote[3]) * 10 / full_vote) >= 8) {
                    node.style.color = kf_opt.vote3_color;
                    //if (full_vote >= 5000) node.style.fontWeight = "bold";
                }
            }
           // if (is_read) node.style.fontWeight = "bold";
        }
    }
    if (label.length <= 2) label = " " + label;
    label = " (" + label + ")";

    node.textContent = label;
    node.href = href;
}

function kf_parse_vote(res) {
    var vote = [0,0,0,0,0];
    var result = res.result;

    for (var i=0; result && i < result.length && i < result.length; i++) {
        vote[i] = result[i].count;
    }
    return vote;
}

function kf_append_link(node, ex_node, res, topic_id, cached, vote) {
    var ex_node_org = ex_node;
    if (!ex_node) ex_node = document.createElement("a");

    if (res) {
        cached = kf_store_cache_ex(res, topic_id, kf_mode_init, vote);
    }
    var href = node.firstChild.href.replace(/\?.*/, "?o=2");

    //console.log("kf_append_link(%s)", topic_id);

    ex_node.onclick = function(e) {
        if (e.ctrlKey && e.shiftKey && cached) {
            localStorage[kf_prefix + topic_id] = kf_cache_fmt(topic_id, cached.res_num, cached.owner_num, cached.epoch, kf_mode_init, vote);
            cached.read_mode = kf_mode_init;
            kf_make_label(ex_node, cached, res, vote, href);
            return false;
        }
        else {
            cached.read_mode = kf_mode_read;
            kf_make_label(ex_node, cached, res, vote, href);
        }
    }
    kf_make_label(ex_node, cached, res, vote, href);

    if (!ex_node_org) {
        try {
            node.nextSibling.nextSibling.appendChild(ex_node);
            node.nextSibling.nextSibling.style.textAlign = "right";
        } catch(e) {
            console.log("kf_append_link error(%s)", topic_id);
        }
    }
    return  ex_node;
}

function kf_ajax_vote(node, ex_node, res, topic_id, cached)
{
    var xhr = new XMLHttpRequest();
    xhr.responseType = "json";
    xhr.onreadystatechange = function() {
        if(xhr.readyState == 4) {
            var vote = null;
            if (xhr.status == 200 && (vote = kf_parse_vote(xhr.response)) && vote.length >= 5) {
                kf_append_link(node, ex_node, res, topic_id, cached, vote);
            }
            else {
                kf_append_link(node, ex_node, res, topic_id, cached);
            }
        }
    }
    xhr.open('GET', node.firstChild.href.replace(/\.jp\/.*/, ".jp/servlet/GetVoteResult?topic=" + topic_id + "&rescategory=1.2.3.4.5"), true);
    xhr.send();
}

function kf_ajax(node_list, idx)
{
    if (idx == 0) {
        var inr_node = document.getElementsByClassName("inr");
        if (inr_node.length > 0) {
            inr_node = inr_node[0];
            inr_node.style.width = "52px";
        }
    }

    var node     = node_list[idx];
    var topic_id = kf_get_topic_id(node.firstChild.href);

    var cached = kf_load_cache(topic_id);
    try { var res_num = node.nextSibling.nextSibling.textContent; }
    catch(e) { 
        if (++idx < node_list.length) {
            kf_ajax(node_list, idx);
        }
        return;
    }

    if ((!cached && kf_opt.no_full_check) || cached && res_num == cached.res_num || res_num == 0) {
        var ex_node = kf_append_link(node, null, null, topic_id, cached, cached && cached.vote);
        if ((!cached || !cached.vote) && kf_is_vote_check()) {
            kf_ajax_vote(node, ex_node, null, topic_id, cached);
        }
        //if (cached) console.log("cvote=" + cached.vote);
        if (++idx < node_list.length) {
            kf_ajax(node_list, idx);
        }
    }
    else {
        if (cached) {
           //console.log("res=%s/%s %s", res_num, cached.res_num, localStorage[kf_prefix + topic_id]);
        }
        else if (res_num > 0) {
            kf_store_cache(topic_id, res_num, 0, kf_mode_init);
        }
        var xhr  = new XMLHttpRequest();
        xhr.responseType = "document";
        xhr.onreadystatechange = function() {
            if(xhr.readyState == 4) {
                if (xhr.status == 200) {
                    var res = xhr.response;
                    var ex_node = kf_append_link(node, null, res, topic_id, cached, cached && cached.vote);
                    if (kf_is_vote_check()) kf_ajax_vote(node, ex_node, res, topic_id, cached);
                }
                if (++idx < node_list.length) {
                    kf_ajax(node_list, idx);
                }
            }
        }
        xhr.open('GET', node.firstChild.href.replace(/\?.*/, "?p=" + Math.floor((Number(res_num) + 19) / 20 + 1)), true);
        xhr.send();
    }
}

function kf_helper() {
    switch (kf_opt.cache_ctrl) {
    case 1:                   break;
    case 2: kf_cache_clear(); break;
    }
    kf_opt.count      = localStorage.kf_count ? Number(localStorage.kf_count) : 0;
    kf_opt.cache_ctrl = 0;
    kf_save(function() { window.close(); });
}

function kf_main()
{
    if (kf_opt.cache_ctrl && location.href.match(/komachi\.yomiuri\.co\.jp\/help\/policy\.htm/i)) {
        kf_helper();
    }
    else if (location.href.match(/komachi\.yomiuri\.co\.jp\/[^t]/i)) {
        var nlist = document.getElementsByClassName("hd");
        kf_ajax(nlist, 0);
    }
    else if (location.href.match(/komachi\.yomiuri\.co\.jp\/t\/.*/i)) {
        var topic_id = kf_get_topic_id(location.href);
        kf_store_cache_ex(document, topic_id, kf_mode_read);
    }
}

kf_load(kf_main);


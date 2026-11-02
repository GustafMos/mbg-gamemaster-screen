using System.Text;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Nodes;

// Builds the compact JS data bundles used by the DM screen from the 5etools
// JSON files in /raw. Run: dotnet run --project tools/DataBuilder
var root = FindRoot();
var raw = Path.Combine(root, "tools", "raw");
var outDir = Path.Combine(root, "data");
Directory.CreateDirectory(outDir);

var opts = new JsonSerializerOptions
{
    Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
    WriteIndented = false,
};

int Write(string file, string global, JsonNode node)
{
    var js = $"window.DND_DATA=window.DND_DATA||{{}};window.DND_DATA.{global}={node.ToJsonString(opts)};";
    File.WriteAllText(Path.Combine(outDir, file), js, new UTF8Encoding(false));
    Console.WriteLine($"{file,-22} {js.Length / 1024.0,8:N0} KB");
    return js.Length;
}

JsonNode? Load(string rel)
{
    var p = Path.Combine(raw, rel);
    if (!File.Exists(p)) { Console.WriteLine("MISSING " + rel); return null; }
    return JsonNode.Parse(File.ReadAllText(p));
}

string FindRoot()
{
    var d = new DirectoryInfo(AppContext.BaseDirectory);
    while (d != null && !File.Exists(Path.Combine(d.FullName, "index.html"))) d = d.Parent;
    return d?.FullName ?? Directory.GetCurrentDirectory();
}

// ---------------------------------------------------------------------------
// Monsters
// ---------------------------------------------------------------------------
var monsterSources = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
{
    "MM", "CoS", "MPMM", "MTF", "VGM", "VRGR", "PHB", "DMG", "TCE", "XGE",
    "SKT", "ToA", "OotA", "PotA", "CoA", "BGDIA", "WDMM", "WDH", "EGW", "ERLW",
    "GGR", "FTD", "SCC", "IDRotF", "IMR", "CM", "GoS", "HotDQ", "RoT", "LMoP"
};

var monsterFields = new[]
{
    "name","source","page","size","type","alignment","ac","hp","speed","str","dex","con","int","wis","cha",
    "save","skill","senses","passive","languages","cr","trait","action","bonus","reaction","legendary","mythic",
    "spellcasting","conditionImmune","immune","resist","vulnerable","gear","variant","legendaryHeader",
    "legendaryGroup","environment","isNpc","group","damageTags","miscTags"
};

// Load every bestiary file so copies that reference other books can be resolved.
var monsterIndex = new Dictionary<string, JsonObject>(StringComparer.OrdinalIgnoreCase);
foreach (var f in Directory.GetFiles(Path.Combine(raw, "bestiary"), "bestiary-*.json").OrderBy(x => x))
{
    var doc = JsonNode.Parse(File.ReadAllText(f));
    foreach (var m in doc?["monster"]?.AsArray() ?? new JsonArray())
    {
        if (m is not JsonObject mo) continue;
        var name = mo["name"]?.GetValue<string>();
        var source = mo["source"]?.GetValue<string>();
        if (name == null || source == null) continue;
        monsterIndex.TryAdd(name + "|" + source, mo);
    }
}

// Deep merge of a 5etools `_copy` entry: inherit the base, apply simple text/array
// mods, then overlay the copy's own fields.
JsonObject? ResolveMonster(string name, string source, int depth = 0)
{
    if (depth > 8) return null;
    if (!monsterIndex.TryGetValue(name + "|" + source, out var raw2)) return null;
    JsonObject result;
    if (raw2["_copy"] is JsonObject copy)
    {
        var bn = copy["name"]?.GetValue<string>();
        var bs = copy["source"]?.GetValue<string>();
        var baseObj = (bn != null && bs != null) ? ResolveMonster(bn, bs, depth + 1) : null;
        result = baseObj?.DeepClone().AsObject() ?? new JsonObject();
        if (copy["_mod"] is JsonObject mods)
        {
            foreach (var kv in mods)
            {
                var target = kv.Key;
                if (kv.Value is not JsonObject mod) continue;
                var mode = mod["mode"]?.GetValue<string>();
                if (mode == "replaceTxt")
                {
                    var find = mod["replace"]?.GetValue<string>() ?? "";
                    var repl = mod["with"]?.GetValue<string>() ?? "";
                    if (find.Length > 0)
                    {
                        if (target == "*") ReplaceText(result, find, repl);
                        else if (result[target] != null) result[target] = ReplaceText(result[target]!.DeepClone(), find, repl);
                    }
                }
                else if (mode is "appendArr" or "prependArr" or "replaceOrAppendArr" or "insertArr")
                {
                    var itemsArr = mod["items"]?.DeepClone();
                    if (itemsArr == null) continue;
                    var newItems = itemsArr is JsonArray ia ? ia : new JsonArray(itemsArr);
                    var existing = result[target] as JsonArray;
                    if (existing == null)
                    {
                        result[target] = newItems;
                    }
                    else if (mode == "prependArr") { for (int i = newItems.Count - 1; i >= 0; i--) existing.Insert(0, newItems[i]!.DeepClone()); }
                    else existing.Add(newItems.DeepClone());
                }
            }
        }
    }
    else result = new JsonObject();

    foreach (var kv in raw2)
    {
        if (kv.Key == "_copy" || kv.Key == "_mod") continue;
        result[kv.Key] = kv.Value?.DeepClone();
    }
    return result;
}

var monsters = new List<JsonObject>();
var seen = new HashSet<string>();
foreach (var f in Directory.GetFiles(Path.Combine(raw, "bestiary"), "bestiary-*.json").OrderBy(x => x))
{
    var src = Path.GetFileNameWithoutExtension(f).Replace("bestiary-", "");
    if (!monsterSources.Contains(src)) continue;
    var doc = JsonNode.Parse(File.ReadAllText(f));
    var arr = doc?["monster"]?.AsArray();
    if (arr == null) continue;
    foreach (var m in arr)
    {
        if (m is not JsonObject mo) continue;
        var name = mo["name"]?.GetValue<string>();
        var source = mo["source"]?.GetValue<string>();
        if (name == null || source == null) continue;
        var key = name + "|" + source;
        if (!seen.Add(key)) continue;
        var resolved = ResolveMonster(name, source);
        if (resolved == null || resolved["hp"] == null) continue;
        var o = new JsonObject();
        foreach (var k in monsterFields)
            if (resolved.TryGetPropertyValue(k, out var v) && v != null) o[k] = v.DeepClone();
        monsters.Add(o);
    }
}
monsters = monsters.OrderBy(m => m["name"]!.GetValue<string>(), StringComparer.OrdinalIgnoreCase).ToList();
Write("bestiary.js", "monsters", new JsonArray(monsters.ToArray()));

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------
var skipSources = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
{
    "XPHB", "XDMG", "XMM", "EFA", "FRHoF"
};
var itemFields = new[]
{
    "name","source","page","type","typeAlt","rarity","reqAttune","reqAttuneAlt","reqAttuneTags","wondrous",
    "baseItem","weight","weightNote","value","valueRarity","dmg1","dmg2","dmgType","range","property","mastery",
    "bonusWeapon","bonusWeaponAttack","bonusWeaponDamage","bonusAc","bonusSpellAttack","bonusSpellSaveDc",
    "bonusSavingThrow","bonusAbilityCheck","bonusProficiencyBonus","bonusSavingThrowConcentration",
    "entries","additionalEntries","charges","recharge","rechargeAmount","attachedSpells","curse","sentient",
    "staff","tattoo","weaponCategory","ammoType","armor","stealth","strength","detail1","detail2",
    "resist","immune","vulnerable","conditionImmune","grantsProficiency","grantsLanguage","focus","packContents",
    "containerCapacity","capCargo","crew","crewMin","crewMax","speed","vehAc","vehHp","vehSpeed","vehDmgThresh",
    "shipCrew","shipCargo","shipArmor","seeAlsoDeck","spellScrollLevel","srd","basicRules","group","alias",
    "lootTables","miscTags","ability","age","size","ac"
};

var items = new List<JsonObject>();
var itemsDoc = Load("items.json");
var itemSeen = new HashSet<string>();
foreach (var node in itemsDoc?["item"]?.AsArray() ?? new JsonArray())
{
    if (node is not JsonObject it) continue;
    var name = it["name"]?.GetValue<string>();
    var source = it["source"]?.GetValue<string>();
    if (name == null || source == null) continue;
    if (skipSources.Contains(source)) continue;
    if (it.ContainsKey("_copy")) continue;
    var key = name + "|" + source;
    if (!itemSeen.Add(key)) continue;
    var o = new JsonObject();
    foreach (var k in itemFields)
        if (it.TryGetPropertyValue(k, out var v) && v != null) o[k] = v.DeepClone();
    items.Add(o);
}
items = items.OrderBy(m => m["name"]!.GetValue<string>(), StringComparer.OrdinalIgnoreCase).ToList();

// ---------------------------------------------------------------------------
// Magic item variants (Flame Tongue, Holy Avenger, Vorpal Sword, …). 5etools
// stores these as templates applied to a base item; expand them into concrete
// entries so the search engine can find them.
// ---------------------------------------------------------------------------
var baseByName = new Dictionary<string, JsonObject>(StringComparer.OrdinalIgnoreCase);
foreach (var node in Load("items-base.json")?["baseitem"]?.AsArray() ?? new JsonArray())
{
    if (node is JsonObject bi && bi["name"] != null) baseByName.TryAdd(bi["name"]!.GetValue<string>(), bi);
}

string ReqText(JsonArray? requires)
{
    if (requires == null) return "";
    bool has(Func<JsonObject, bool> pred) => requires.OfType<JsonObject>().Any(pred);
    if (has(o => o["sword"]?.GetValue<bool>() == true)) return "any sword";
    if (has(o => o["bow"]?.GetValue<bool>() == true)) return "any bow";
    if (has(o => o["weapon"]?.GetValue<bool>() == true)) return "any weapon";
    if (has(o => o["armor"]?.GetValue<bool>() == true)) return "any armor";
    if (has(o => o["weaponCategory"] != null)) return "any weapon";
    var names = requires.OfType<JsonObject>().Select(o => o["name"]?.GetValue<string>()).Where(x => x != null).ToList();
    if (names.Count > 0) return "a specific base item (" + string.Join(", ", names.Take(3)) + ")";
    var types = requires.OfType<JsonObject>().Select(o => o["type"]?.GetValue<string>()).Where(x => x != null).ToList();
    if (types.Count > 0)
    {
        var codes = types.Where(t => t != null).Select(t => t!.Split('|')[0]).ToHashSet();
        if (codes.Overlaps(new[] { "A", "AF" })) return "ammunition";
        if (codes.Overlaps(new[] { "LA", "MA", "HA" })) return "any armor";
        if (codes.Contains("S")) return "a shield";
        if (codes.Contains("SCF")) return "a spellcasting focus";
        return "a base item";
    }
    return "";
}

var existingItemKeys = new HashSet<string>(items.Select(i => i["name"]!.GetValue<string>() + "|" + i["source"]!.GetValue<string>()), StringComparer.OrdinalIgnoreCase);
var swordBases = new[] { "Longsword", "Greatsword", "Shortsword", "Rapier", "Scimitar" };
var bowBases = new[] { "Longbow", "Shortbow" };

foreach (var node in Load("magicvariants.json")?["magicvariant"]?.AsArray() ?? new JsonArray())
{
    if (node is not JsonObject mv) continue;
    if (mv["inherits"] is not JsonObject inh) continue;
    var name = mv["name"]?.GetValue<string>();
    var source = inh["source"]?.GetValue<string>();
    if (name == null || source == null) continue;
    if (skipSources.Contains(source)) continue;

    var requires = mv["requires"] as JsonArray;
    var reqText = ReqText(requires);
    bool isSword = requires != null && requires.OfType<JsonObject>().Any(o => o["sword"]?.GetValue<bool>() == true);
    bool isBow = requires != null && requires.OfType<JsonObject>().Any(o => o["bow"]?.GetValue<bool>() == true);
    bool isWeapon = isSword || isBow || (requires != null && requires.OfType<JsonObject>().Any(o => o["weapon"]?.GetValue<bool>() == true || o["weaponCategory"] != null));
    bool isArmor = requires != null && requires.OfType<JsonObject>().Any(o => o["armor"]?.GetValue<bool>() == true);
    bool isAmmo = requires != null && requires.OfType<JsonObject>().Any(o => (o["type"]?.GetValue<string>() ?? "").Split('|')[0] is "A" or "AF");
    var firstType = (mv["type"]?.GetValue<string>() ?? "").Split('|')[0];
    var typeCode = isAmmo ? "A" : isSword || isWeapon ? "M" : isBow ? "R" : isArmor ? "MA" : firstType == "" ? "W" : firstType;

    JsonObject MakeVariant(string variantName, JsonObject? baseItem)
    {
        var o = new JsonObject();
        foreach (var kv in inh)
        {
            if (kv.Key is "namePrefix" or "reprintedAs" or "lootTables" or "referenceSources" or "classFeatures" or "entriesTemplate") continue;
            if (kv.Value != null) o[kv.Key] = kv.Value.DeepClone();
        }
        o["name"] = variantName;
        o["source"] = source;
        o["type"] = typeCode;
        if (reqText.Length > 0) o["requiresText"] = baseItem != null ? baseItem["name"]?.GetValue<string>() : reqText;
        if (baseItem != null)
        {
            if (baseItem["dmg1"] != null) o["dmg1"] = baseItem["dmg1"]!.DeepClone();
            if (baseItem["dmg2"] != null) o["dmg2"] = baseItem["dmg2"]!.DeepClone();
            if (baseItem["dmgType"] != null) o["dmgType"] = baseItem["dmgType"]!.DeepClone();
            if (baseItem["property"] != null) o["property"] = baseItem["property"]!.DeepClone();
            if (baseItem["weight"] != null) o["weight"] = baseItem["weight"]!.DeepClone();
            if (baseItem["weaponCategory"] != null) o["weaponCategory"] = baseItem["weaponCategory"]!.DeepClone();
            if (baseItem["range"] != null) o["range"] = baseItem["range"]!.DeepClone();
            o["baseItem"] = baseItem["name"]!.GetValue<string>() + "|" + (baseItem["source"]?.GetValue<string>() ?? "PHB");
        }
        else if (isWeapon)
        {
            o["weaponCategory"] = "martial";
        }
        // The inherited entries are the magic item's rules text.
        if (inh["entries"] != null) o["entries"] = inh["entries"]!.DeepClone();
        return o;
    }

    var generic = MakeVariant(name, null);
    if (existingItemKeys.Add(name + "|" + source)) items.Add(generic);

    if (isSword || isBow)
    {
        foreach (var bn in (isSword ? swordBases : bowBases))
        {
            if (!baseByName.TryGetValue(bn, out var baseItem)) continue;
            var vn = name + " (" + bn + ")";
            if (!existingItemKeys.Add(vn + "|" + source)) continue;
            items.Add(MakeVariant(vn, baseItem));
        }
    }
}
items = items.OrderBy(m => m["name"]!.GetValue<string>(), StringComparer.OrdinalIgnoreCase).ToList();

var bases = new JsonArray();
var baseSeen = new HashSet<string>();
foreach (var node in Load("items-base.json")?["baseitem"]?.AsArray() ?? new JsonArray())
{
    if (node is not JsonObject it) continue;
    var name = it["name"]?.GetValue<string>();
    var source = it["source"]?.GetValue<string>();
    if (name == null || source == null) continue;
    if (skipSources.Contains(source)) continue;
    var key = name + "|" + source;
    if (!baseSeen.Add(key)) continue;
    var o = new JsonObject();
    foreach (var k in new[] { "name","source","page","type","rarity","weight","value","weaponCategory","property","dmg1","dmg2","dmgType","range","armor","stealth","strength","entries","additionalEntries","srd","basicRules","mastery","firearm","focus" })
        if (it.TryGetPropertyValue(k, out var v) && v != null) o[k] = v.DeepClone();
    bases.Add(o);
}

var itemBundle = new JsonObject
{
    ["items"] = new JsonArray(items.ToArray()),
    ["bases"] = bases,
    ["types"] = Load("items-base.json")?["itemType"]?.DeepClone() ?? new JsonArray(),
    ["props"] = Load("items-base.json")?["itemProperty"]?.DeepClone() ?? new JsonArray(),
};
Write("items.js", "items", itemBundle);

// ---------------------------------------------------------------------------
// Spells
// ---------------------------------------------------------------------------
var spellFields = new[]
{
    "name","source","page","level","school","time","range","components","duration","entries",
    "entriesHigherLevel","scalingLevelDice","damageInflict","savingThrow","areaTags","miscTags","classes",
    "srd","basicRules","ritual","concentration","groups"
};
var spells = new List<JsonObject>();
var spellSeen = new HashSet<string>();
foreach (var f in Directory.GetFiles(Path.Combine(raw, "spells"), "spells-*.json").OrderBy(x => x))
{
    if (f.EndsWith("xphb.json")) continue;
    var doc = JsonNode.Parse(File.ReadAllText(f));
    foreach (var node in doc?["spell"]?.AsArray() ?? new JsonArray())
    {
        if (node is not JsonObject sp) continue;
        var name = sp["name"]?.GetValue<string>();
        var source = sp["source"]?.GetValue<string>();
        if (name == null || source == null) continue;
        if (sp.ContainsKey("_copy")) continue;
        var key = name + "|" + source;
        if (!spellSeen.Add(key)) continue;
        var o = new JsonObject();
        foreach (var k in spellFields)
            if (sp.TryGetPropertyValue(k, out var v) && v != null) o[k] = v.DeepClone();
        spells.Add(o);
    }
}
spells = spells.OrderBy(m => m["name"]!.GetValue<string>(), StringComparer.OrdinalIgnoreCase).ToList();
Write("spells.js", "spells", new JsonArray(spells.ToArray()));

// ---------------------------------------------------------------------------
// Rules: conditions, feats, actions glossary
// ---------------------------------------------------------------------------
var rules = new JsonObject();
var cond = Load("conditionsdiseases.json");
rules["conditions"] = FilterNamed(cond?["condition"]?.AsArray(), new[] { "name","source","page","entries","srd","basicRules" });
rules["diseases"] = FilterNamed(cond?["disease"]?.AsArray(), new[] { "name","source","page","entries" });

var feats = new JsonArray();
var featSeen = new HashSet<string>();
foreach (var node in Load("feats.json")?["feat"]?.AsArray() ?? new JsonArray())
{
    if (node is not JsonObject ft) continue;
    var name = ft["name"]?.GetValue<string>();
    var source = ft["source"]?.GetValue<string>();
    if (name == null || source == null) continue;
    if (skipSources.Contains(source)) continue;
    if (ft.ContainsKey("_copy")) continue;
    if (!featSeen.Add(name + "|" + source)) continue;
    var o = new JsonObject();
    foreach (var k in new[] { "name","source","page","prerequisite","entries","ability","srd","basicRules" })
        if (ft.TryGetPropertyValue(k, out var v) && v != null) o[k] = v.DeepClone();
    feats.Add(o);
}
rules["feats"] = feats;

var actionsDoc = Load("actions.json");
rules["actions"] = FilterNamed(actionsDoc?["action"]?.AsArray(), new[] { "name","source","page","entries","srd","basicRules","seeAlso" });
Write("rules.js", "rules", rules);

// ---------------------------------------------------------------------------
// adventure adventure
// ---------------------------------------------------------------------------
var adv = Load("adventure/adventure-cos.json");
var chapters = adv?["adventureData"]?[0]?["data"]?.DeepClone() ?? new JsonArray();
Write("adventure-cos.js", "cos", chapters);

// ---------------------------------------------------------------------------
// Tarokka deck
// ---------------------------------------------------------------------------
var deckDoc = Load("decks.json");
JsonObject? tarokkaDeck = null;
foreach (var d in deckDoc?["deck"]?.AsArray() ?? new JsonArray())
{
    if (d?["name"]?.GetValue<string>() == "Tarokka Deck" && d?["source"]?.GetValue<string>() == "CoS")
    { tarokkaDeck = d.AsObject(); break; }
}
var cards = new JsonArray();
foreach (var c in deckDoc?["card"]?.AsArray() ?? new JsonArray())
{
    if (c?["set"]?.GetValue<string>() != "Tarokka Deck") continue;
    if (c?["source"]?.GetValue<string>() != "CoS") continue;
    cards.Add(new JsonObject
    {
        ["name"] = c["name"]?.DeepClone(),
        ["suit"] = c["suit"]?.DeepClone(),
        ["value"] = c["value"]?.DeepClone(),
        ["entries"] = c["entries"]?.DeepClone(),
        ["page"] = c["page"]?.DeepClone(),
    });
}
var tarokka = new JsonObject
{
    ["cards"] = cards,
    ["deckEntries"] = tarokkaDeck?["entries"]?.DeepClone(),
    ["spread"] = tarokkaDeck?["spreads"]?[0]?.DeepClone(),
};
Write("tarokka.js", "tarokka", tarokka);

Console.WriteLine("Done.");

// helpers
static JsonNode ReplaceText(JsonNode node, string find, string repl)
{
    switch (node)
    {
        case JsonObject o:
        {
            var n = new JsonObject();
            foreach (var kv in o)
                n[kv.Key] = kv.Value == null ? null : ReplaceText(kv.Value.DeepClone(), find, repl);
            return n;
        }
        case JsonArray a:
        {
            var n = new JsonArray();
            foreach (var x in a)
                n.Add(x == null ? null : ReplaceText(x.DeepClone(), find, repl));
            return n;
        }
        case JsonValue v when v.TryGetValue<string>(out var s):
            return JsonValue.Create(System.Text.RegularExpressions.Regex.Replace(s, System.Text.RegularExpressions.Regex.Escape(find), repl, System.Text.RegularExpressions.RegexOptions.IgnoreCase))!;
        default:
            return node.DeepClone();
    }
}

static JsonArray FilterNamed(JsonArray? arr, string[] fields)
{
    var outArr = new JsonArray();
    if (arr == null) return outArr;
    foreach (var node in arr)
    {
        if (node is not JsonObject o) continue;
        var n = new JsonObject();
        foreach (var k in fields)
            if (o.TryGetPropertyValue(k, out var v) && v != null) n[k] = v.DeepClone();
        outArr.Add(n);
    }
    return outArr;
}

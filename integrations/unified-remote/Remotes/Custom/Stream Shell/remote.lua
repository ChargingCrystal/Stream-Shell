-- Stream Shell Unified Remote v0.8.3
-- All controls use the native Stream Shell bridge. The remote queries bridge
-- state so Wide-only auxiliary actions disappear in Compact.

local script = libs.script;
local server = libs.server;
local timer = libs.timer;
local current_layout = "unknown";
local status_poll_id = -1;

local neutral_color = "#66707d";
local active_neutral_color = "#8792a2";

local auxiliary_colors = {
    discord = "#5865f2",
    twitch = "#7c3aed",
    twitch_drops = "#d97706"
};

local provider_colors = {
    youtube = "#7a2432",
    netflix = "#721d24",
    prime = "#145a86",
    disney = "#285665",
    crunchyroll = "#8a3b13"
};

local provider_ids = {
    "youtube",
    "netflix",
    "prime",
    "disney",
    "crunchyroll"
};

local function sync_button_highlights(profile, left, right, twitch_target, settings_open, volume_active)
    local updates = {};

    for _, provider in ipairs(provider_ids) do
        table.insert(updates, {
            id = provider,
            color = left == provider and provider_colors[provider] or neutral_color
        });
    end

    table.insert(updates, {
        id = "landing",
        color = left == "landing" and active_neutral_color or neutral_color
    });

    local compact = profile == "compact";
    local dashboard_active = compact
        and left == "dashboard"
        or (not compact and right == "dashboard");
    local settings_active = settings_open and (compact or right == "dashboard");

    table.insert(updates, {
        id = "dashboard",
        color = dashboard_active and active_neutral_color or neutral_color
    });

    table.insert(updates, {
        id = "settings",
        color = settings_active and active_neutral_color or neutral_color
    });

    table.insert(updates, {
        id = "volume",
        color = volume_active and active_neutral_color or neutral_color
    });

    table.insert(updates, {
        id = "discord",
        color = right == "discord" and auxiliary_colors.discord or neutral_color
    });

    local drops_active = right == "twitch" and twitch_target == "drops";
    local twitch_active = right == "twitch" and not drops_active;

    table.insert(updates, {
        id = "twitch",
        color = twitch_active and auxiliary_colors.twitch or neutral_color
    });

    table.insert(updates, {
        id = "twitch_drops",
        color = drops_active and auxiliary_colors.twitch_drops or neutral_color
    });

    server.update(unpack(updates));
end

local function set_status(text)
    layout.status.text = text;
end

local function trim(value)
    local text = tostring(value or "");
    text = string.gsub(text, "^%s+", "");
    text = string.gsub(text, "%s+$", "");
    return text;
end

local function run_helper(line)
    local out, err, result = script.powershell(
        "$exe = Join-Path $env:LOCALAPPDATA 'StreamShell\\TitlebarHost\\StreamShellTitlebarHost.exe'",
        "if (-not (Test-Path -LiteralPath $exe)) { Write-Output 'ERR helper-missing'; exit 20 }",
        line,
        "exit $LASTEXITCODE"
    );

    local response = trim(out);
    if response == "" then response = trim(err); end
    if response == "" then response = "ERR no-response"; end
    return response, result;
end

local function pretty_mode(mode)
    local names = {
        landing = "Landing",
        dashboard = "Dashboard",
        youtube = "YouTube",
        netflix = "Netflix",
        prime = "Prime",
        disney = "Disney+",
        crunchyroll = "Crunchyroll"
    };
    return names[mode] or mode or "Unknown";
end

local function apply_layout_visibility(profile)
    local compact = profile == "compact";
    current_layout = profile or "unknown";

    layout.landing.visibility = compact and "gone" or "visible";
    layout.aux_label.visibility = compact and "gone" or "visible";
    layout.discord.visibility = compact and "gone" or "visible";
    layout.twitch.visibility = compact and "gone" or "visible";
    layout.twitch_drops.visibility = compact and "gone" or "visible";
end

local function sync_status()
    local response = run_helper("& $exe --status");

    if not string.find(response, "OK status ", 1, true) then
        set_status(response);
        return false;
    end

    local profile = string.match(response, "layout=([^%s]+)") or "unknown";
    local left = string.match(response, "left=([^%s]+)") or "unknown";
    local right = string.match(response, "right=([^%s]+)") or "unknown";
    local twitch_target = string.match(response, "twitchTarget=([^%s]+)") or "resume";
    local settings = string.match(response, "settings=([^%s]+)") or "0";
    local volume = string.match(response, "volume=([^%s]+)") or "0";

    apply_layout_visibility(profile);

    local surface = pretty_mode(left);
    local profile_label = profile == "wide" and "WIDE" or (profile == "compact" and "COMPACT" or string.upper(profile));
    local suffix = settings == "1" and " · Settings" or "";
    if volume == "1" then
        suffix = suffix .. " · Volume Boost";
    end
    set_status("CONNECTED · " .. profile_label .. " · " .. surface .. suffix);
    sync_button_highlights(profile, left, right, twitch_target, settings == "1", volume == "1");

    return true;
end

local function bridge_action(action)
    set_status("SENDING · " .. string.upper(action));

    local response = run_helper("& $exe --action " .. action);

    if string.find(response, "OK " .. action, 1, true) then
        if action == "kill" then
            set_status("SHUTDOWN REQUESTED");
            return true;
        end

        os.sleep(300);
        sync_status();
        return true;
    end

    set_status(response);
    print("Stream Shell bridge response: " .. response);
    return false;
end

local function stop_status_poll()
    if status_poll_id ~= -1 then
        timer.cancel(status_poll_id);
        status_poll_id = -1;
    end
end

local function start_status_poll()
    stop_status_poll();
    sync_status();
    status_poll_id = timer.interval(sync_status, 1000);
end

actions.init = function ()
    sync_status();
end

events.focus = function ()
    start_status_poll();
end

events.blur = function ()
    stop_status_poll();
end

actions.refresh = function ()
    sync_status();
end

actions.landing = function () bridge_action("landing") end
actions.dashboard = function () bridge_action("dashboard") end
actions.settings = function () bridge_action("settings") end

actions.youtube = function () bridge_action("youtube") end
actions.netflix = function () bridge_action("netflix") end
actions.prime = function () bridge_action("prime") end
actions.disney = function () bridge_action("disney") end
actions.crunchyroll = function () bridge_action("crunchyroll") end

actions.reload = function () bridge_action("reload") end
actions.volume = function () bridge_action("volume") end

actions.discord = function () bridge_action("discord") end
actions.twitch = function () bridge_action("twitch") end
actions.twitch_drops = function () bridge_action("twitch-drops") end

actions.kill = function () bridge_action("kill") end

import "dotenv/config";
import { Client, GatewayIntentBits } from "discord.js";
import config from "../src/config.json" with { type: "json" };

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

client.once("ready", async () => {
    console.log(`Logged in as ${client.user.tag}`);
    const guild = client.guilds.cache.get(config.guildId);

    if (!guild) {
        console.error(`Guild with ID ${config.guildId} not found! Check config.json.`);
        process.exit(1);
    }

    console.log(`\n--- ROLES in ${guild.name} ---`);
    const roles = await guild.roles.fetch();
    roles.sort((a, b) => b.position - a.position).forEach(role => {
        console.log(`${role.name}: ${role.id}`);
    });

    console.log(`\n--- CHANNELS in ${guild.name} ---`);
    const channels = await guild.channels.fetch();
    channels.forEach(channel => {
        if (channel) console.log(`${channel.name} (${channel.type}): ${channel.id}`);
    });

    console.log("\n--- CONFIG CHECK ---");
    console.log(`Current verifiedRoleId: ${config.verifiedRoleId}`);
    console.log(`Current errorLogChannelId: ${config.errorLogChannelId}`);

    process.exit(0);
});

client.login(process.env.TOKEN);

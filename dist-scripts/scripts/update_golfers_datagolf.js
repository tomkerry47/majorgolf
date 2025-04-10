import 'dotenv/config';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { db, pool } from '../server/db.js'; // Added .js extension
import { golfers } from '../shared/schema.js'; // Added .js extension
import { eq } from 'drizzle-orm'; // Import eq and ilike
const DATAGOLF_RANKINGS_URL = 'https://datagolf.com/datagolf-rankings';
// Helper function to create short name (e.g., R. McIlroy)
function createShortName(firstName, lastName) {
    if (!firstName || !lastName) {
        return null;
    }
    const firstInitial = firstName.charAt(0).toUpperCase();
    return `${firstInitial}. ${lastName}`;
}
async function updateGolfersFromDataGolf() {
    console.log('Starting golfer update/insert process from DataGolf...');
    const client = await pool.connect();
    try {
        await client.query('BEGIN'); // Start transaction
        // 1. Fetch existing golfers from DB into a map (use full name as key)
        console.log('Fetching existing golfers from database...');
        const existingGolfers = await db.select({
            id: golfers.id,
            name: golfers.name, // Keep fetching name for matching
            rank: golfers.rank,
            shortName: golfers.shortName,
            firstName: golfers.firstName,
            lastName: golfers.lastName
        }).from(golfers);
        const existingGolferMap = new Map();
        // Add explicit type for 'g' based on the select statement
        existingGolfers.forEach((g) => {
            if (g.name) { // Ensure name exists before adding to map
                existingGolferMap.set(g.name.toLowerCase().trim(), {
                    id: g.id,
                    rank: g.rank,
                    shortName: g.shortName,
                    firstName: g.firstName,
                    lastName: g.lastName
                });
            }
        });
        console.log(`Found ${existingGolferMap.size} existing golfers.`);
        // 2. Fetch HTML content
        console.log(`Fetching HTML from ${DATAGOLF_RANKINGS_URL}...`);
        const { data: html } = await axios.get(DATAGOLF_RANKINGS_URL);
        // Log the entire fetched HTML to inspect its structure
        console.log('--- START OF FETCHED HTML ---');
        console.log(html);
        console.log('--- END OF FETCHED HTML ---');
        const $ = cheerio.load(html);
        // 3. Extract and parse JSON
        console.log('Extracting and parsing JSON data...');
        // Make filter more specific: find script whose content *starts* with the assignment
        const scriptContent = $('script').filter((i, el) => {
            const htmlContent = $(el).html()?.trim(); // Get trimmed content
            return htmlContent?.includes('reload_data = JSON.parse') ?? false;
        }).html();
        if (!scriptContent) {
            throw new Error('Could not find the script tag containing reload_data.');
        }
        console.log('Found script tag. Raw content length:', scriptContent.length); // Log raw content length
        // More robust JSON extraction using Regex
        let jsonString = '';
        // Try non-greedy match first for single quotes
        const regex = /reload_data\s*=\s*JSON\.parse\(\s*'(.*?)'\s*\);/s; // Use non-greedy .*?
        const match = scriptContent.match(regex);
        if (match && match[1]) {
            jsonString = match[1];
            // Manual unescaping might still be needed if the source escapes quotes within the string literal
            try {
                // Handle escaped single quotes and backslashes within the JSON string literal
                jsonString = jsonString.replace(/\\'/g, "'").replace(/\\\\/g, '\\');
                // Note: We don't need to unescape double quotes (\") here because the outer quotes are single (')
            }
            catch (e) {
                console.error("Error during manual unescaping:", e);
                // Decide if you want to throw or continue with potentially problematic string
            }
        }
        else {
            // Fallback for double quotes (also non-greedy)
            const doubleQuoteRegex = /reload_data\s*=\s*JSON\.parse\(\s*"(.*?)"\s*\);/s; // Use non-greedy .*?
            const doubleQuoteMatch = scriptContent.match(doubleQuoteRegex);
            if (doubleQuoteMatch && doubleQuoteMatch[1]) {
                jsonString = doubleQuoteMatch[1];
                try {
                    // Handle escaped double quotes and backslashes
                    jsonString = jsonString.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
                    // Note: We don't need to unescape single quotes (\') here
                }
                catch (e) {
                    console.error("Error during manual unescaping (double quotes):", e);
                }
            }
            else {
                console.error("Failed to find reload_data JSON string with regex. Script content snippet:", scriptContent.substring(0, 500)); // Log snippet
                throw new Error('Script content format unexpected. Could not isolate JSON string using regex.');
            }
        }
        console.log('Extracted JSON string (before parsing, length):', jsonString.length); // Log extracted string length
        let leaderboardJson;
        try {
            leaderboardJson = JSON.parse(jsonString);
        }
        catch (parseError) {
            console.error('Failed to parse JSON string. String content was:', jsonString);
            throw new Error(`Failed to parse JSON from script tag: ${parseError}`);
        }
        console.log("Successfully parsed JSON data.");
        // Log the first few items to check structure
        if (leaderboardJson?.data?.table_data?.data && Array.isArray(leaderboardJson.data.table_data.data)) {
            console.log('First 3 golfer data entries from JSON:', JSON.stringify(leaderboardJson.data.table_data.data.slice(0, 3), null, 2));
        }
        const golferDataArray = leaderboardJson?.data?.table_data?.data;
        if (!golferDataArray || !Array.isArray(golferDataArray)) {
            throw new Error('JSON data structure is not as expected. Could not find golfer data array.');
        }
        console.log(`Found ${golferDataArray.length} golfers in JSON data.`);
        // 4. Process Golfers for Upsert
        const golfersToInsert = [];
        const golfersToUpdate = [];
        let skippedCount = 0;
        for (const golferData of golferDataArray) {
            const firstName = golferData.first?.trim() || null;
            const lastName = golferData.last?.trim() || null;
            if (!firstName || !lastName) {
                console.warn(`Skipping golfer due to missing first or last name:`, golferData);
                skippedCount++;
                continue;
            }
            const fullName = `${firstName} ${lastName}`;
            const shortName = createShortName(firstName, lastName);
            let rank = parseInt(golferData.rank, 10); // Use OWGR rank
            // Check for -9999 rank and replace with 500
            if (rank === -9999) {
                console.log(`Adjusting rank for ${fullName} from -9999 to 500.`);
                rank = 500;
            }
            if (isNaN(rank)) {
                console.warn(`Skipping golfer ${fullName} due to invalid rank: ${golferData.rank}`);
                skippedCount++;
                continue;
            }
            const existingGolfer = existingGolferMap.get(fullName.toLowerCase().trim());
            if (existingGolfer) {
                // Check if update is needed (rank, names might change slightly)
                if (existingGolfer.rank !== rank ||
                    existingGolfer.shortName !== shortName ||
                    existingGolfer.firstName !== firstName ||
                    existingGolfer.lastName !== lastName) {
                    golfersToUpdate.push({
                        id: existingGolfer.id,
                        rank: rank,
                        shortName: shortName,
                        firstName: firstName,
                        lastName: lastName,
                    });
                }
            }
            else {
                // Golfer doesn't exist, prepare for insert
                golfersToInsert.push({
                    name: fullName, // Keep the full name
                    shortName: shortName,
                    firstName: firstName,
                    lastName: lastName,
                    rank: rank,
                    avatarUrl: null,
                });
            }
        }
        // 5. Perform Updates
        if (golfersToUpdate.length > 0) {
            console.log(`Updating ${golfersToUpdate.length} golfers...`);
            for (const golfer of golfersToUpdate) {
                console.log(`Updating golfer ID ${golfer.id}: Rank=${golfer.rank}, Name=${golfer.firstName} ${golfer.lastName}, ShortName=${golfer.shortName}`); // Log update details
                await db.update(golfers)
                    .set({
                    rank: golfer.rank,
                    shortName: golfer.shortName,
                    firstName: golfer.firstName,
                    lastName: golfer.lastName
                })
                    .where(eq(golfers.id, golfer.id));
            }
            console.log('Golfers updated successfully.');
        }
        else {
            console.log('No golfers needed updating.');
        }
        // 6. Perform Inserts
        if (golfersToInsert.length > 0) {
            console.log(`Inserting ${golfersToInsert.length} new golfers...`);
            // Log insert details (maybe first few)
            console.log('First 3 golfers to insert:', JSON.stringify(golfersToInsert.slice(0, 3), null, 2));
            // Use batch insert if supported and preferred, otherwise loop
            await db.insert(golfers).values(golfersToInsert);
            console.log('New golfers inserted successfully.');
        }
        else {
            console.log('No new golfers to insert.');
        }
        if (skippedCount > 0) {
            console.log(`Skipped ${skippedCount} golfers due to invalid data.`);
        }
        await client.query('COMMIT'); // Commit transaction
        console.log(`Golfer update process completed. Updated: ${golfersToUpdate.length}, Inserted: ${golfersToInsert.length}, Skipped: ${skippedCount}.`);
    }
    catch (error) { // Add type annotation for error
        await client.query('ROLLBACK'); // Rollback transaction on error
        console.error('Error updating golfers from DataGolf:');
        if (error instanceof Error) {
            console.error(`Error Message: ${error.message}`);
            console.error(`Error Stack: ${error.stack}`);
        }
        else {
            console.error('Caught non-Error object:', error);
        }
        process.exit(1); // Exit with error code
    }
    finally {
        client.release(); // Release client back to the pool
        await pool.end(); // Close the pool connection
        console.log('Database pool closed.');
    }
}
// Execute the function if the script is run directly
// Now that we compile to JS first, this should work
updateGolfersFromDataGolf();
// Export the function in case it needs to be imported elsewhere (optional)
export { updateGolfersFromDataGolf };

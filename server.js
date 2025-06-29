// hockey-seo-backend/server.js
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// DataForSEO API Configuration (stored in environment variables)
const DATAFORSEO_CONFIG = {
    baseUrl: 'https://api.dataforseo.com/v3',
    login: process.env.DATAFORSEO_LOGIN,
    password: process.env.DATAFORSEO_PASSWORD
};

// Helper function to make DataForSEO API calls
async function makeDataForSEORequest(endpoint, data = [], method = 'POST') {
    const credentials = Buffer.from(`${DATAFORSEO_CONFIG.login}:${DATAFORSEO_CONFIG.password}`).toString('base64');
    
    try {
        const url = method === 'GET' ? 
            `${DATAFORSEO_CONFIG.baseUrl}${endpoint}` : 
            `${DATAFORSEO_CONFIG.baseUrl}${endpoint}`;
            
        const response = await fetch(url, {
            method: method,
            headers: {
                'Authorization': `Basic ${credentials}`,
                'Content-Type': 'application/json'
            },
            body: method === 'POST' ? JSON.stringify(data) : undefined
        });

        if (!response.ok) {
            throw new Error(`DataForSEO API error: ${response.status} ${response.statusText}`);
        }

        const result = await response.json();
        
        if (result.status_code !== 20000) {
            throw new Error(`DataForSEO error: ${result.status_message} (${result.status_code})`);
        }

        return result;
    } catch (error) {
        console.error('DataForSEO API Error:', error);
        throw error;
    }
}

// Helper function to get real SERP data
async function getRealSERPData(keyword) {
    try {
        console.log(`Submitting SERP task for: ${keyword}`);
        
        // Step 1: Submit task
        const taskData = [{
            keyword: keyword,
            location_code: 2840, // United States
            language_code: "en",
            device: "desktop"
        }];

        const taskResult = await makeDataForSEORequest('/serp/google/organic/task_post', taskData);
        
        if (taskResult.tasks && taskResult.tasks[0] && taskResult.tasks[0].id) {
            const taskId = taskResult.tasks[0].id;
            console.log(`Task submitted with ID: ${taskId}`);
            
            // Step 2: Wait for task to process
            await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
            
            // Step 3: Get results
            console.log(`Getting results for task: ${taskId}`);
            const resultsData = await makeDataForSEORequest(`/serp/google/organic/task_get/${taskId}`, [], 'GET');
            
            if (resultsData.tasks && resultsData.tasks[0] && resultsData.tasks[0].result) {
                return resultsData.tasks[0].result[0];
            }
        }
    } catch (error) {
        console.error(`SERP data error for ${keyword}:`, error);
        return null;
    }
}

// Helper function to check if domain belongs to team
function isTeamSite(domain, teamName) {
    if (!domain) return false;
    
    const teamWords = teamName.toLowerCase().split(' ');
    const cleanDomain = domain.toLowerCase();
    
    // Check if any team words are in the domain
    return teamWords.some(word => cleanDomain.includes(word));
}

// Helper function to calculate opportunity score
function calculateOpportunityScore(keyword, teamRank, competitors) {
    let score = 5; // Base score
    
    // Keyword type bonuses
    if (keyword.includes('first time') || keyword.includes('what to expect')) score += 3;
    if (keyword.includes('parking')) score += 2;
    if (keyword.includes('tickets') || keyword.includes('cheap')) score += 2;
    if (keyword.includes('seating')) score += 1;
    
    // Ranking penalties/bonuses
    if (teamRank === -1) score += 3; // Not ranking at all
    else if (teamRank > 10) score += 2; // Page 2+
    else if (teamRank > 5) score += 1; // Bottom of page 1
    else if (teamRank <= 3) score -= 1; // Already ranking well
    
    // Competitor analysis
    const ticketResellers = ['ticketmaster.com', 'stubhub.com', 'seatgeek.com', 'vividseats.com'];
    const hasTicketResellers = competitors.some(comp => 
        ticketResellers.some(reseller => comp.includes(reseller))
    );
    if (hasTicketResellers) score += 1;
    
    return Math.min(Math.max(score, 3), 10);
}

// Helper function to determine gap type
function getGapType(keyword, competitors) {
    if (keyword.includes('first time') || keyword.includes('what to expect')) {
        return 'First-Timer Experience Gap';
    }
    if (keyword.includes('parking')) {
        return 'Arena Information Gap';
    }
    if (competitors.some(comp => ['ticketmaster.com', 'stubhub.com', 'seatgeek.com'].includes(comp))) {
        return 'Ticket Reseller Dominance';
    }
    if (keyword.includes('seating') || keyword.includes('arena')) {
        return 'Venue Experience Gap';
    }
    return 'General Content Gap';
}

// Helper function to generate content suggestions
function getContentSuggestion(keyword) {
    if (keyword.includes('first time') || keyword.includes('what to expect')) {
        return {
            title: 'Complete First-Timer\'s Hockey Guide',
            format: 'FAQ-style guide with arena tips and terminology',
            cta: 'Buy Official Tickets'
        };
    }
    if (keyword.includes('parking')) {
        return {
            title: 'Ultimate Arena Parking Guide',
            format: 'Interactive map with pricing and walking times',
            cta: 'Reserve Parking & Tickets'
        };
    }
    if (keyword.includes('seating')) {
        return {
            title: 'Interactive Arena Seating Guide',
            format: 'Visual seating chart with ice view photos',
            cta: 'Find Your Perfect Seats'
        };
    }
    return {
        title: 'Comprehensive Fan Guide',
        format: 'Detailed FAQ with local tips',
        cta: 'Get Tickets'
    };
}

// Helper function to generate LLM strategy
function getLLMStrategy(keyword) {
    if (keyword.includes('first time') || keyword.includes('what to expect')) {
        return 'Create conversational Q&A content optimized for voice search and AI assistants';
    }
    if (keyword.includes('parking') || keyword.includes('seating')) {
        return 'Use structured data and local context for location-based AI search';
    }
    return 'Optimize with natural language and hockey-specific terminology for AI search';
}

// Simulation fallback functions
function generateSimulatedSearchVolume(keyword) {
    if (keyword.includes('tickets') || keyword.includes('cheap')) {
        return Math.floor(Math.random() * 800) + 200; // 200-1000
    }
    if (keyword.includes('first time') || keyword.includes('what to expect')) {
        return Math.floor(Math.random() * 400) + 150; // 150-550
    }
    if (keyword.includes('parking')) {
        return Math.floor(Math.random() * 300) + 100; // 100-400
    }
    return Math.floor(Math.random() * 200) + 50; // 50-250
}

function getSimulatedCompetitors(keyword) {
    if (keyword.includes('tickets')) {
        return ['stubhub.com', 'ticketmaster.com', 'seatgeek.com'];
    }
    if (keyword.includes('parking')) {
        return ['spothero.com', 'parkwhiz.com', 'yelp.com'];
    }
    if (keyword.includes('first time')) {
        return ['reddit.com', 'tripadvisor.com', 'hockeyforum.com'];
    }
    return ['reddit.com', 'yelp.com', 'hockeydb.com'];
}

// Main API endpoint for SEO analysis
app.post('/api/analyze', async (req, res) => {
    try {
        const { teamName, league, keywords } = req.body;
        
        if (!teamName || !keywords || !Array.isArray(keywords)) {
            return res.status(400).json({ 
                error: 'Missing required fields: teamName and keywords array' 
            });
        }

        console.log(`Starting analysis for: ${teamName} (${league})`);
        
        const analyses = [];
        const maxRealAnalyses = 3; // Limit real API calls to control costs
        
        // Process keywords (mix of real API and simulation)
        for (let i = 0; i < Math.min(5, keywords.length); i++) {
            const keyword = keywords[i];
            let analysis;
            
            if (i < maxRealAnalyses && DATAFORSEO_CONFIG.login && DATAFORSEO_CONFIG.password) {
                // Try real API for first few keywords
                try {
                    const serpData = await getRealSERPData(keyword);
                    
                    if (serpData && serpData.items) {
                        // Process real SERP data
                        const items = serpData.items;
                        const competitors = items.slice(0, 3).map(item => item.domain).filter(Boolean);
                        
                        // Find team ranking
                        let teamRank = -1;
                        items.forEach((item, index) => {
                            if (item.domain && isTeamSite(item.domain, teamName)) {
                                teamRank = index + 1;
                            }
                        });

                        analysis = {
                            keyword: keyword,
                            opportunity: calculateOpportunityScore(keyword, teamRank, competitors),
                            gapType: getGapType(keyword, competitors),
                            teamRank: teamRank === -1 ? 'Not found' : `#${teamRank}`,
                            competitors: competitors.slice(0, 3),
                            contentSuggestion: getContentSuggestion(keyword),
                            llmStrategy: getLLMStrategy(keyword),
                            searchVolume: generateSimulatedSearchVolume(keyword), // Still simulate for cost control
                            isRealData: true,
                            cost: serpData.cost || 0
                        };
                        
                        console.log(`Real data analysis complete for: ${keyword}`);
                    } else {
                        throw new Error('No SERP data returned');
                    }
                } catch (error) {
                    console.log(`Real API failed for ${keyword}, using simulation:`, error.message);
                    analysis = createSimulatedAnalysis(keyword, teamName);
                }
            } else {
                // Use simulation
                analysis = createSimulatedAnalysis(keyword, teamName);
            }
            
            analyses.push(analysis);
        }
        
        // Sort by opportunity score
        analyses.sort((a, b) => b.opportunity - a.opportunity);
        
        console.log(`Analysis complete for ${teamName}. Real data: ${analyses.filter(a => a.isRealData).length}/${analyses.length}`);
        
        res.json({
            success: true,
            teamName: teamName,
            league: league,
            totalKeywords: keywords.length,
            analyses: analyses,
            summary: {
                highOpportunity: analyses.filter(a => a.opportunity >= 7).length,
                totalSearchVolume: analyses.reduce((sum, a) => sum + a.searchVolume, 0),
                realDataCount: analyses.filter(a => a.isRealData).length
            }
        });
        
    } catch (error) {
        console.error('Analysis error:', error);
        res.status(500).json({ 
            error: 'Analysis failed', 
            message: error.message 
        });
    }
});

// Helper function to create simulated analysis
function createSimulatedAnalysis(keyword, teamName) {
    const competitors = getSimulatedCompetitors(keyword);
    const teamRank = Math.random() > 0.6 ? -1 : Math.floor(Math.random() * 10) + 1;
    
    return {
        keyword: keyword,
        opportunity: calculateOpportunityScore(keyword, teamRank, competitors),
        gapType: getGapType(keyword, competitors),
        teamRank: teamRank === -1 ? 'Not found' : `#${teamRank}`,
        competitors: competitors.slice(0, 3),
        contentSuggestion: getContentSuggestion(keyword),
        llmStrategy: getLLMStrategy(keyword),
        searchVolume: generateSimulatedSearchVolume(keyword),
        isRealData: false,
        cost: 0
    };
}

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        hasDataForSEOCredentials: !!(DATAFORSEO_CONFIG.login && DATAFORSEO_CONFIG.password)
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🏒 Hockey SEO Backend running on port ${PORT}`);
    console.log(`🔑 DataForSEO credentials: ${DATAFORSEO_CONFIG.login ? 'Configured' : 'Missing'}`);
    console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
});

module.exports = app;
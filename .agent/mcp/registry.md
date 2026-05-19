# Hermes MCP Server Registry

## Active MCP Servers

| Server | Purpose | Key Tools |
|--------|---------|-----------|
| **Firecrawl** | Web scraping, search, extraction | firecrawl_scrape, firecrawl_search, firecrawl_crawl, firecrawl_agent |
| **DataForSEO** | SEO data, keywords, SERPs, backlinks | serp_organic_live_advanced, labs_google_keyword_overview, backlinks_summary |
| **Ahrefs** | Domain rating, backlinks, keywords | ahrefs_domain_overview, ahrefs_backlinks_count, ahrefs_organic_keywords |
| **Semrush** | Keyword research, domain analytics | semrush_domain_overview, semrush_keyword_overview, semrush_batch_keyword_overview |
| **Exa** | Web search & content extraction | web_search_exa, web_fetch_exa |
| **Tavily** | AI-optimized web search & research | tavily_search, tavily_research, tavily_extract, tavily_crawl |
| **GitHub** | Repos, PRs, issues, commits | create_pull_request, push_files, get_file_contents, search_repositories |
| **Render** | Deploy management | render_list_services, render_get_deploy, render_get_service |
| **Supabase** | Database, auth, edge functions | execute_sql, apply_migration, get_project, list_projects |
| **Playwright** | Browser automation, e2e testing | init_browser, get_screenshot, official_browser_navigate |
| **Apify** | Web scraping Actors | call_actor, search_actors, fetch_actor_details |
| **Slack** | Messaging, file sharing | post_message, get_channel_history, search_messages |
| **Linear** | Issue tracking | create_issue, search_issues, get_teams |
| **Notion** | Documentation | post_page, query_data_source, post_search |
| **n8n** | Workflow automation | search_nodes, search_templates, validate_workflow |
| **Docker** | Container management | docker_container_list, docker_container_logs |
| **Google** | Analytics, GSC, Maps, Drive | ga_run_report, gsc_search_analytics, get_geocode |
| **Figma** | Design extraction | get_figma_file, get_image_fills, list_components |
| **Airtable** | Spreadsheet automation | list_records, create_record, update_records |
| **WordPress** | CMS content management | create_post, search_posts, update_post |
| **Publer** | Social media scheduling | create_post, list_accounts, upload_media_from_url |

## Default Routing
- **Content extraction**: Firecrawl_scrape (primary) → Tavily_extract (fallback)
- **SEO research**: DataForSEO (primary) → Semrush + Ahrefs (cross-reference)
- **Web search**: Firecrawl_search (primary) → Tavily_search (deep research)
- **Browser automation**: Playwright (local) → Firecrawl_interact (remote)
- **Deployment**: Render auto-deploy (git push) → Render API (manual trigger)

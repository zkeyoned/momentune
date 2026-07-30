package main

import (
	"flag"
	"log"
)

// 脚本目录与输出路径（相对于项目根，脚本从项目根用 go run ./scripts/build-music-library 运行）
const (
	keywordsF = "scripts/build-music-library/keywords.txt"

	progressSoda    = "scripts/build-music-library/progress_soda.json"
	progressNetease = "scripts/build-music-library/progress_netease.json"
	progressQQ      = "scripts/build-music-library/progress_qq.json"

	outputSoda    = "data/soda_songs.json"
	outputNetease = "data/netease_songs.json"
	outputQQ      = "data/qq_songs.json"
)

func main() {
	platform := flag.String("platform", "all", "平台: soda/netease/qq/all")
	limit := flag.Int("limit", 0, "只处理前 N 个关键词（0 表示全部）")
	flag.Parse()

	keywords, err := readKeywords(keywordsF)
	if err != nil {
		log.Fatalf("读取 keywords.txt 失败: %v", err)
	}
	if *limit > 0 && *limit < len(keywords) {
		keywords = keywords[:*limit]
	}
	log.Printf("共 %d 个关键词（platform=%s, limit=%d）", len(keywords), *platform, *limit)

	switch *platform {
	case "soda":
		runCrawler(&SodaCrawler{}, "soda", keywords, progressSoda, outputSoda)
	case "netease":
		runCrawler(&NeteaseCrawler{}, "netease", keywords, progressNetease, outputNetease)
	case "qq":
		runCrawler(&QQCrawler{}, "qq", keywords, progressQQ, outputQQ)
	case "all":
		runCrawler(&SodaCrawler{}, "soda", keywords, progressSoda, outputSoda)
		runCrawler(&NeteaseCrawler{}, "netease", keywords, progressNetease, outputNetease)
		runCrawler(&QQCrawler{}, "qq", keywords, progressQQ, outputQQ)
	default:
		log.Fatalf("未知 platform: %s（支持 soda/netease/qq/all）", *platform)
	}
}

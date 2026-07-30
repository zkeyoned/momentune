package main

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/guohuiyuan/music-lib/model"
)

// SongRecord 是去重后写入 songs json 的歌曲结构
type SongRecord struct {
	PlatformID  string   `json:"platform_id"`
	Platform    string   `json:"platform"`
	Title       string   `json:"title"`
	Artist      string   `json:"artist"`
	Album       string   `json:"album"`
	Duration    int      `json:"duration"`
	RawTags     []string `json:"raw_tags"`
	AppearCount int      `json:"appear_count"`
}

// Progress 记录断点续传状态
type Progress struct {
	CompletedKeywords  []string `json:"completed_keywords"`
	ScrapedPlaylistIDs []string `json:"scraped_playlist_ids"`
}

// Crawler 定义多平台抓取器接口
type Crawler interface {
	SearchPlaylists(keyword string) ([]model.Playlist, error)
	GetSongs(playlistID string) ([]model.Song, error)
}

const requestInterval = 500 * time.Millisecond

// normalizeKey 生成归一化去重 key（转小写+去空格）
func normalizeKey(title, artist string) string {
	s := strings.ToLower(title + artist)
	return strings.Join(strings.Fields(s), "")
}

// readKeywords 读取关键词文件，跳过空行与 # 注释行
func readKeywords(path string) ([]string, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var out []string
	for _, line := range strings.Split(string(data), "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		out = append(out, line)
	}
	if out == nil {
		out = []string{}
	}
	return out, nil
}

// loadProgress 加载断点续传状态；文件不存在返回空 Progress（切片非 nil）
func loadProgress(path string) Progress {
	p := Progress{
		CompletedKeywords:  []string{},
		ScrapedPlaylistIDs: []string{},
	}
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return p
		}
		log.Printf("[警告] 读取 %s 失败: %v，使用空状态", path, err)
		return p
	}
	if err := json.Unmarshal(data, &p); err != nil {
		log.Printf("[警告] 解析 %s 失败: %v，使用空状态", path, err)
		return Progress{CompletedKeywords: []string{}, ScrapedPlaylistIDs: []string{}}
	}
	if p.CompletedKeywords == nil {
		p.CompletedKeywords = []string{}
	}
	if p.ScrapedPlaylistIDs == nil {
		p.ScrapedPlaylistIDs = []string{}
	}
	return p
}

// saveProgress 写入 progress 文件
func saveProgress(path string, p Progress) {
	if p.CompletedKeywords == nil {
		p.CompletedKeywords = []string{}
	}
	if p.ScrapedPlaylistIDs == nil {
		p.ScrapedPlaylistIDs = []string{}
	}
	data, err := json.MarshalIndent(p, "", "  ")
	if err != nil {
		log.Printf("[错误] 序列化 progress 失败: %v", err)
		return
	}
	if err := os.WriteFile(path, data, 0644); err != nil {
		log.Printf("[错误] 写入 %s 失败: %v", path, err)
	}
}

// loadSongs 加载已抓歌曲；文件不存在返回空切片
func loadSongs(path string) []SongRecord {
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return []SongRecord{}
		}
		log.Printf("[警告] 读取 %s 失败: %v", path, err)
		return []SongRecord{}
	}
	var out []SongRecord
	if err := json.Unmarshal(data, &out); err != nil {
		log.Printf("[警告] 解析 %s 失败: %v，从空开始", path, err)
		return []SongRecord{}
	}
	if out == nil {
		out = []SongRecord{}
	}
	return out
}

// saveSongs 把 songMap 转为切片排序后写入文件
// 排序：AppearCount 降序，再按 Title 升序
func saveSongs(path string, songMap map[string]*SongRecord) {
	out := make([]SongRecord, 0, len(songMap))
	for _, r := range songMap {
		tags := make([]string, len(r.RawTags))
		copy(tags, r.RawTags)
		rec := *r
		rec.RawTags = tags
		if rec.RawTags == nil {
			rec.RawTags = []string{}
		}
		out = append(out, rec)
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].AppearCount != out[j].AppearCount {
			return out[i].AppearCount > out[j].AppearCount
		}
		return out[i].Title < out[j].Title
	})
	data, err := json.MarshalIndent(out, "", "  ")
	if err != nil {
		log.Printf("[错误] 序列化 songs 失败: %v", err)
		return
	}
	dir := filepath.Dir(path)
	if dir != "" && dir != "." {
		if err := os.MkdirAll(dir, 0755); err != nil {
			log.Printf("[错误] 创建 %s 目录失败: %v", dir, err)
			return
		}
	}
	if err := os.WriteFile(path, data, 0644); err != nil {
		log.Printf("[错误] 写入 %s 失败: %v", path, err)
	}
}

// mergeSong 将一首歌曲合并到 songMap
func mergeSong(songMap map[string]*SongRecord, s model.Song, kw string, platform string) {
	key := normalizeKey(s.Name, s.Artist)
	if rec, ok := songMap[key]; ok {
		rec.AppearCount++
		has := false
		for _, g := range rec.RawTags {
			if g == kw {
				has = true
				break
			}
		}
		if !has {
			rec.RawTags = append(rec.RawTags, kw)
		}
		return
	}
	tags := make([]string, 0, 4)
	tags = append(tags, kw)
	songMap[key] = &SongRecord{
		PlatformID:  s.ID,
		Platform:    platform,
		Title:       s.Name,
		Artist:      s.Artist,
		Album:       s.Album,
		Duration:    s.Duration,
		RawTags:     tags,
		AppearCount: 1,
	}
}

// printStats 输出统计信息
func printStats(songMap map[string]*SongRecord) {
	total := len(songMap)
	tagCount := make(map[string]int)
	appearGE3 := 0
	for _, r := range songMap {
		for _, g := range r.RawTags {
			tagCount[g]++
		}
		if r.AppearCount >= 3 {
			appearGE3++
		}
	}
	tags := make([]string, 0, len(tagCount))
	for g := range tagCount {
		tags = append(tags, g)
	}
	sort.Strings(tags)
	fmt.Println("========== 统计 ==========")
	fmt.Printf("总歌曲数: %d\n", total)
	fmt.Println("各标签歌曲数:")
	for _, g := range tags {
		fmt.Printf("  %s: %d\n", g, tagCount[g])
	}
	fmt.Printf("appear_count ≥ 3 的歌曲数: %d\n", appearGE3)
	fmt.Println("==========================")
}

// toSet 将切片转为 set（map[value]bool）
func toSet(items []string) map[string]bool {
	m := make(map[string]bool, len(items))
	for _, v := range items {
		m[v] = true
	}
	return m
}

// runCrawler 通用抓取流程：遍历关键词，过滤歌单，抓取歌曲，断点续传
func runCrawler(c Crawler, platform string, keywords []string, progressPath string, outputPath string) {
	progress := loadProgress(progressPath)
	completedSet := toSet(progress.CompletedKeywords)
	scrapedSet := toSet(progress.ScrapedPlaylistIDs)

	songs := loadSongs(outputPath)
	songMap := make(map[string]*SongRecord, len(songs))
	for i := range songs {
		key := normalizeKey(songs[i].Title, songs[i].Artist)
		songMap[key] = &songs[i]
	}
	log.Printf("[%s] 已有 %d 首歌曲（断点续传加载）", platform, len(songMap))

	for _, kw := range keywords {
		if completedSet[kw] {
			log.Printf("[%s][跳过] 关键词 %q 已完成", platform, kw)
			continue
		}
		log.Printf("[%s] ===== 处理关键词: %s =====", platform, kw)

		// 4.1 搜索歌单
		time.Sleep(requestInterval)
		playlists, err := c.SearchPlaylists(kw)
		if err != nil {
			log.Printf("[%s][错误] SearchPlaylists(%q) 失败: %v，跳过该关键词", platform, kw, err)
			continue
		}
		log.Printf("[%s] 搜索到 %d 个歌单", platform, len(playlists))

		// 4.2 过滤 track_count
		var filtered []model.Playlist
		for _, p := range playlists {
			if p.TrackCount >= 20 && p.TrackCount <= 500 {
				filtered = append(filtered, p)
			}
		}
		log.Printf("[%s] 过滤后(20≤track_count≤500) %d 个歌单", platform, len(filtered))

		// 4.3 取前10
		if len(filtered) > 10 {
			filtered = filtered[:10]
		}
		log.Printf("[%s] 取前 %d 个歌单处理", platform, len(filtered))

		// 4.4 逐个歌单拉取歌曲
		for idx, pl := range filtered {
			if scrapedSet[pl.ID] {
				log.Printf("[%s]  [%d/%d] 歌单 %s(%s) 已抓过，跳过", platform, idx+1, len(filtered), pl.Name, pl.ID)
				continue
			}
			log.Printf("[%s]  [%d/%d] 拉取歌单 %s(%s) track_count=%d", platform, idx+1, len(filtered), pl.Name, pl.ID, pl.TrackCount)

			time.Sleep(requestInterval)
			sList, err := c.GetSongs(pl.ID)
			if err != nil {
				log.Printf("[%s]  [错误] GetSongs(%s) 失败: %v，跳过该歌单", platform, pl.ID, err)
				continue
			}
			log.Printf("[%s]  歌单含 %d 首歌曲", platform, len(sList))

			// 4.5 合并歌曲
			for _, s := range sList {
				mergeSong(songMap, s, kw, platform)
			}

			// 4.6 记录已抓 + 落盘
			scrapedSet[pl.ID] = true
			progress.ScrapedPlaylistIDs = append(progress.ScrapedPlaylistIDs, pl.ID)
			saveProgress(progressPath, progress)
			saveSongs(outputPath, songMap)
		}

		// 4.7 关键词完成
		completedSet[kw] = true
		progress.CompletedKeywords = append(progress.CompletedKeywords, kw)
		saveProgress(progressPath, progress)
		log.Printf("[%s] 关键词 %q 完成", platform, kw)
	}

	printStats(songMap)
	log.Printf("[%s] 完成！输出: %s", platform, outputPath)
}

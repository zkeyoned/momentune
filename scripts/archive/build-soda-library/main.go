package main

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"sort"
	"strings"
	"time"

	"github.com/guohuiyuan/music-lib/model"
	"github.com/guohuiyuan/music-lib/soda"
)

// SongRecord 是去重后写入 soda_songs.json 的歌曲结构
type SongRecord struct {
	SodaID      string   `json:"soda_id"`
	Title       string   `json:"title"`
	Artist      string   `json:"artist"`
	Album       string   `json:"album"`
	Duration    int      `json:"duration"`
	Genres      []string `json:"genres"`
	AppearCount int      `json:"appear_count"`
}

// Progress 记录断点续传状态
type Progress struct {
	CompletedKeywords  []string `json:"completed_keywords"`
	ScrapedPlaylistIDs []string `json:"scraped_playlist_ids"`
}

// 脚本目录与输出路径（相对于项目根，脚本从项目根用 go run ./scripts/build-soda-library 运行）
const (
	keywordsF  = "scripts/build-soda-library/keywords.txt"
	progressF  = "scripts/build-soda-library/progress.json"
	outputDir  = "data"
	outputFile = "data/soda_songs.json"
)

const requestInterval = 500 * time.Millisecond

// sodaPlaylist 是过滤用的轻量结构（避免直接依赖 model.Playlist 导入）
type sodaPlaylist struct {
	ID         string
	Name       string
	TrackCount int
}

func main() {
	// 1. 读取关键词
	keywords, err := readKeywords(keywordsF)
	if err != nil {
		log.Fatalf("读取 keywords.txt 失败: %v", err)
	}
	log.Printf("共 %d 个关键词: %v", len(keywords), keywords)

	// 2. 加载 progress
	progress := loadProgress()
	// 用 map 快速查找
	completedSet := toSet(progress.CompletedKeywords)
	scrapedSet := toSet(progress.ScrapedPlaylistIDs)

	// 3. 加载已有歌曲（断点续传合并）
	songs := loadSongs()
	songMap := make(map[string]*SongRecord, len(songs))
	for i := range songs {
		songMap[songs[i].normalizeKey()] = &songs[i]
	}
	log.Printf("已有 %d 首歌曲（断点续传加载）", len(songMap))

	// 4. 主循环
	for _, kw := range keywords {
		if completedSet[kw] {
			log.Printf("[跳过] 关键词 %q 已完成", kw)
			continue
		}
		log.Printf("===== 处理关键词: %s =====", kw)

		// 4.1 搜索歌单
		time.Sleep(requestInterval)
		playlists, err := soda.SearchPlaylist(kw)
		if err != nil {
			log.Printf("[错误] SearchPlaylist(%q) 失败: %v，跳过该关键词", kw, err)
			continue
		}
		log.Printf("搜索到 %d 个歌单", len(playlists))

		// 4.2 过滤 track_count
		var filtered []sodaPlaylist
		for _, p := range playlists {
			if p.TrackCount >= 20 && p.TrackCount <= 500 {
				filtered = append(filtered, sodaPlaylist{ID: p.ID, Name: p.Name, TrackCount: p.TrackCount})
			}
		}
		log.Printf("过滤后(20≤track_count≤500) %d 个歌单", len(filtered))

		// 4.3 取前10
		if len(filtered) > 10 {
			filtered = filtered[:10]
		}
		log.Printf("取前 %d 个歌单处理", len(filtered))

		// 4.4 逐个歌单拉取歌曲
		for idx, pl := range filtered {
			if scrapedSet[pl.ID] {
				log.Printf("  [%d/%d] 歌单 %s(%s) 已抓过，跳过", idx+1, len(filtered), pl.Name, pl.ID)
				continue
			}
			log.Printf("  [%d/%d] 拉取歌单 %s(%s) track_count=%d", idx+1, len(filtered), pl.Name, pl.ID, pl.TrackCount)

			time.Sleep(requestInterval)
			sList, err := soda.GetPlaylistSongs(pl.ID)
			if err != nil {
				log.Printf("  [错误] GetPlaylistSongs(%s) 失败: %v，跳过该歌单", pl.ID, err)
				continue
			}
			log.Printf("  歌单含 %d 首歌曲", len(sList))

			// 4.5 合并歌曲
			for _, s := range sList {
				mergeSong(songMap, s, kw)
			}

			// 4.6 记录已抓 + 落盘
			scrapedSet[pl.ID] = true
			progress.ScrapedPlaylistIDs = append(progress.ScrapedPlaylistIDs, pl.ID)
			saveProgress(progress)
			saveSongs(songMap)
		}

		// 4.7 关键词完成
		completedSet[kw] = true
		progress.CompletedKeywords = append(progress.CompletedKeywords, kw)
		saveProgress(progress)
		log.Printf("关键词 %q 完成", kw)
	}

	// 5. 统计输出
	printStats(songMap)
	log.Printf("完成！输出: %s", outputFile)
}

// mergeSong 将一首 soda 歌曲合并到 songMap
func mergeSong(songMap map[string]*SongRecord, s model.Song, kw string) {
	key := normalizeKey(s.Name, s.Artist)
	if rec, ok := songMap[key]; ok {
		// 已存在：AppearCount++；genre 去重追加（保持插入顺序）
		rec.AppearCount++
		has := false
		for _, g := range rec.Genres {
			if g == kw {
				has = true
				break
			}
		}
		if !has {
			rec.Genres = append(rec.Genres, kw)
		}
		return
	}
	// 新歌：初始化 Genres 为非 nil 单元素切片
	genres := make([]string, 0, 4)
	genres = append(genres, kw)
	songMap[key] = &SongRecord{
		SodaID:      s.ID,
		Title:       s.Name,
		Artist:      s.Artist,
		Album:       s.Album,
		Duration:    s.Duration,
		Genres:      genres,
		AppearCount: 1,
	}
}

// normalizeKey 生成归一化去重 key
func normalizeKey(title, artist string) string {
	s := strings.ToLower(title + artist)
	return strings.Join(strings.Fields(s), "")
}

func (r SongRecord) normalizeKey() string {
	return normalizeKey(r.Title, r.Artist)
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
func loadProgress() Progress {
	p := Progress{
		CompletedKeywords:  []string{},
		ScrapedPlaylistIDs: []string{},
	}
	data, err := os.ReadFile(progressF)
	if err != nil {
		if os.IsNotExist(err) {
			return p
		}
		log.Printf("[警告] 读取 progress.json 失败: %v，使用空状态", err)
		return p
	}
	if err := json.Unmarshal(data, &p); err != nil {
		log.Printf("[警告] 解析 progress.json 失败: %v，使用空状态", err)
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

// loadSongs 加载已抓歌曲；文件不存在返回空切片
func loadSongs() []SongRecord {
	data, err := os.ReadFile(outputFile)
	if err != nil {
		if os.IsNotExist(err) {
			return []SongRecord{}
		}
		log.Printf("[警告] 读取 %s 失败: %v", outputFile, err)
		return []SongRecord{}
	}
	var out []SongRecord
	if err := json.Unmarshal(data, &out); err != nil {
		log.Printf("[警告] 解析 %s 失败: %v，从空开始", outputFile, err)
		return []SongRecord{}
	}
	if out == nil {
		out = []SongRecord{}
	}
	return out
}

// saveProgress 写入 progress.json
func saveProgress(p Progress) {
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
	if err := os.WriteFile(progressF, data, 0644); err != nil {
		log.Printf("[错误] 写入 progress.json 失败: %v", err)
	}
}

// saveSongs 把 songMap 转为切片排序后写入 soda_songs.json
// 排序：AppearCount 降序，再按 Title 升序
func saveSongs(songMap map[string]*SongRecord) {
	out := make([]SongRecord, 0, len(songMap))
	for _, r := range songMap {
		// 拷贝 Genres 切片，避免共享底层数组
		genres := make([]string, len(r.Genres))
		copy(genres, r.Genres)
		rec := *r
		rec.Genres = genres
		if rec.Genres == nil {
			rec.Genres = []string{}
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
	if err := os.MkdirAll(outputDir, 0755); err != nil {
		log.Printf("[错误] 创建 %s 目录失败: %v", outputDir, err)
		return
	}
	if err := os.WriteFile(outputFile, data, 0644); err != nil {
		log.Printf("[错误] 写入 %s 失败: %v", outputFile, err)
	}
}

// printStats 输出统计信息
func printStats(songMap map[string]*SongRecord) {
	total := len(songMap)

	// 各流派歌曲数：每首歌的每个 genre 都 +1
	genreCount := make(map[string]int)
	appearGE3 := 0
	for _, r := range songMap {
		for _, g := range r.Genres {
			genreCount[g]++
		}
		if r.AppearCount >= 3 {
			appearGE3++
		}
	}

	// 按 genre 名升序输出，保证稳定
	genres := make([]string, 0, len(genreCount))
	for g := range genreCount {
		genres = append(genres, g)
	}
	sort.Strings(genres)

	fmt.Println("========== 统计 ==========")
	fmt.Printf("总歌曲数: %d\n", total)
	fmt.Println("各流派歌曲数:")
	for _, g := range genres {
		fmt.Printf("  %s: %d\n", g, genreCount[g])
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

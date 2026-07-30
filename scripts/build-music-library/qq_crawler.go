package main

import (
	"github.com/guohuiyuan/music-lib/model"
	"github.com/guohuiyuan/music-lib/qq"
)

type QQCrawler struct{}

func (c *QQCrawler) SearchPlaylists(keyword string) ([]model.Playlist, error) {
	return qq.SearchPlaylist(keyword)
}

func (c *QQCrawler) GetSongs(playlistID string) ([]model.Song, error) {
	return qq.GetPlaylistSongs(playlistID)
}

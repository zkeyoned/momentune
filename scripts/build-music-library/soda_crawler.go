package main

import (
	"github.com/guohuiyuan/music-lib/model"
	"github.com/guohuiyuan/music-lib/soda"
)

type SodaCrawler struct{}

func (c *SodaCrawler) SearchPlaylists(keyword string) ([]model.Playlist, error) {
	return soda.SearchPlaylist(keyword)
}

func (c *SodaCrawler) GetSongs(playlistID string) ([]model.Song, error) {
	return soda.GetPlaylistSongs(playlistID)
}

module.exports = {
	'priviledges': [ 'delete_board', 'create_board', 'edit_board', 'admin_board', 'promote_user',
  	'create_user', 'delete_user', 'edit_user', 'search_user', 'ban_user', 'unban_user',
		'kill_replies', 'delete_comment', 'can_reply', 'can_post', 'delete_thread', 'admin_admins', 'admin_issues' //Remove admin_issues
  ],
  'max_info_requests': 500,
	'max_alive_posts': 1,
  'issue_categories': [ 'SPAM', 'ILLEGAL', 'RULES', 'BUG', 'SECURITY', 'INAPROPRIATE', 'USER' ],
  'max_board_search_count': 20,
  'recent_search_range': 7200, // Seconds
	'max_thread_search_resutls': 250,
	'excerpts_per_thread': 3,
	'excerpts_substring': 30,
	'max_user_search_results': 50,
	'max_notif_list_results': 300,
	'max_thread_replies': 500, // Maximum nunmber of replies per thread
	'max_reply_subreplies': 50, // Maximum number of sub-replies per reply
	'creme_of_the_top_max': 10,
	'alias_change_rate': 24, // How often can a user change his alias (hours)
	'max_upload_size': 7340032, // Max file size in bytes
	'allowed_file_types': ['pdf', 'mp4', 'gif', 'jpeg', 'webm', 'png'],
	'image_mime_type': ['image/gif', 'image/jpeg', 'image/png'],
	'video_mime_type': ['video/webm', 'video/mp4'],
	// Ude G settings
	'college_centers': [ 'CUAAD', 'CUCBA', 'CUCEA', 'CUCEI', 'CUCS', 'CUCSH',  'CUALTOS',
		'CUCIENAGA', 'CUCOSTA', 'CUCSUR', 'CULAGOS', 'CUNORTE', 'CUSUR', 'CUTONALA', 'CUVALLES'
	]
};

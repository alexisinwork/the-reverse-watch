<?php
/** Removes the plugin's settings when it is deleted. */
if (!defined('WP_UNINSTALL_PLUGIN')) {
	exit;
}
delete_option('the_reserve_settings');

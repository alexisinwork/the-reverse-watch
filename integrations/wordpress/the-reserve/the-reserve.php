<?php
/**
 * Plugin Name:       The Reserve Watch Widgets
 * Plugin URI:        https://thereserve.watch/partners
 * Description:       Add The Reserve's watch finder, archetype quiz, film watch search, cheaper alternatives and watch stories to any page with a shortcode or block.
 * Version:           1.0.0
 * Requires at least: 6.0
 * Requires PHP:      7.4
 * Author:            The Reserve
 * Author URI:        https://thereserve.watch
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       the-reserve
 *
 * Shortcode: [the_reserve feature="quiz"]
 * Features:  quiz, archetype, find, alternatives, stories
 * Optional:  scheme="light" accent="#0a7cff" bg="#ffffff" surface="#f5f5f7"
 *            text="#111111" font="system|serif" radius="8" params="q=Heat&type=movie"
 */

if (!defined('ABSPATH')) {
	exit;
}

define('THE_RESERVE_VERSION', '1.0.0');
define('THE_RESERVE_OPTION', 'the_reserve_settings');
define('THE_RESERVE_DEFAULT_URL', 'https://thereserve.watch');

function the_reserve_features() {
	return array(
		'quiz'         => __('Watch diagnostic (shortlist)', 'the-reserve'),
		'archetype'    => __('Watch archetype quiz', 'the-reserve'),
		'find'         => __('Watches from film, TV and people', 'the-reserve'),
		'alternatives' => __('Cheaper alternatives', 'the-reserve'),
		'stories'      => __('Watches from movies (stories)', 'the-reserve'),
	);
}

function the_reserve_settings() {
	$defaults = array(
		'key'      => '',
		'scheme'   => '',
		'accent'   => '',
		'bg'       => '',
		'surface'  => '',
		'text'     => '',
		'font'     => '',
		'radius'   => '',
		'base_url' => THE_RESERVE_DEFAULT_URL,
	);
	$saved = get_option(THE_RESERVE_OPTION, array());
	return wp_parse_args(is_array($saved) ? $saved : array(), $defaults);
}

/** Keeps only values the widget accepts; anything else is dropped. */
function the_reserve_clean_theme(array $input) {
	$clean = array();
	if (isset($input['scheme']) && in_array($input['scheme'], array('light', 'dark'), true)) {
		$clean['scheme'] = $input['scheme'];
	}
	foreach (array('accent', 'bg', 'surface', 'text') as $name) {
		if (!empty($input[$name])) {
			$color = sanitize_hex_color('#' . ltrim((string) $input[$name], '#'));
			if ($color && strlen($color) === 7) {
				$clean[$name] = $color;
			}
		}
	}
	if (isset($input['font']) && in_array($input['font'], array('system', 'serif'), true)) {
		$clean['font'] = $input['font'];
	}
	if (isset($input['radius']) && $input['radius'] !== '' && is_numeric($input['radius'])) {
		$clean['radius'] = (string) max(0, min(32, (int) $input['radius']));
	}
	return $clean;
}

function the_reserve_sanitize_settings($input) {
	$input = is_array($input) ? $input : array();
	$key   = isset($input['key']) ? trim(sanitize_text_field($input['key'])) : '';
	if ($key !== '' && !preg_match('/^pk_live_[A-Za-z0-9]{24}$/', $key)) {
		add_settings_error(THE_RESERVE_OPTION, 'the_reserve_key', __('The public key looks like pk_live_ followed by 24 letters and digits.', 'the-reserve'));
		$key = '';
	}
	$base = isset($input['base_url']) ? esc_url_raw(trim($input['base_url']), array('https')) : '';
	$theme = the_reserve_clean_theme($input);
	return array_merge(
		array(
			'key'      => $key,
			'base_url' => $base ? untrailingslashit($base) : THE_RESERVE_DEFAULT_URL,
			'scheme'   => '',
			'accent'   => '',
			'bg'       => '',
			'surface'  => '',
			'text'     => '',
			'font'     => '',
			'radius'   => '',
		),
		$theme
	);
}

// ---- Script -----------------------------------------------------------------

function the_reserve_register_script() {
	$settings = the_reserve_settings();
	wp_register_script(
		'the-reserve-embed',
		$settings['base_url'] . '/embed.js',
		array(),
		null,
		array('in_footer' => true, 'strategy' => 'async')
	);
}
add_action('wp_enqueue_scripts', 'the_reserve_register_script');

/** Adds the key and site-wide theme to the script tag. */
function the_reserve_script_tag($tag, $handle) {
	if ($handle !== 'the-reserve-embed') {
		return $tag;
	}
	$settings   = the_reserve_settings();
	$attributes = ' data-key="' . esc_attr($settings['key']) . '"';
	foreach (the_reserve_clean_theme($settings) as $name => $value) {
		$attributes .= ' data-' . $name . '="' . esc_attr($value) . '"';
	}
	return str_replace(' src=', $attributes . ' src=', $tag);
}
add_filter('script_loader_tag', 'the_reserve_script_tag', 10, 2);

// ---- Shortcode and block ------------------------------------------------------

function the_reserve_render(array $atts) {
	$settings = the_reserve_settings();
	$feature  = isset($atts['feature']) ? sanitize_key($atts['feature']) : 'quiz';
	if (!array_key_exists($feature, the_reserve_features())) {
		$feature = 'quiz';
	}
	if ($settings['key'] === '') {
		return current_user_can('manage_options')
			? '<p><em>' . esc_html__('The Reserve: add your public key under Settings → The Reserve.', 'the-reserve') . '</em></p>'
			: '';
	}
	wp_enqueue_script('the-reserve-embed');

	$attributes = ' data-reserve="' . esc_attr($feature) . '"';
	foreach (the_reserve_clean_theme($atts) as $name => $value) {
		$attributes .= ' data-' . $name . '="' . esc_attr($value) . '"';
	}
	if (!empty($atts['params'])) {
		$attributes .= ' data-params="' . esc_attr(sanitize_text_field($atts['params'])) . '"';
	}
	if (!empty($atts['height']) && is_numeric($atts['height'])) {
		$attributes .= ' data-height="' . esc_attr((string) max(200, min(3000, (int) $atts['height']))) . '"';
	}
	$label = the_reserve_features()[$feature];
	return '<div class="the-reserve-widget"' . $attributes . '><noscript>' . esc_html($label) . ' — https://thereserve.watch</noscript></div>';
}

function the_reserve_shortcode($atts) {
	$atts = shortcode_atts(
		array(
			'feature' => 'quiz',
			'scheme'  => '',
			'accent'  => '',
			'bg'      => '',
			'surface' => '',
			'text'    => '',
			'font'    => '',
			'radius'  => '',
			'params'  => '',
			'height'  => '',
		),
		$atts,
		'the_reserve'
	);
	return the_reserve_render($atts);
}
add_shortcode('the_reserve', 'the_reserve_shortcode');

function the_reserve_register_block() {
	if (!function_exists('register_block_type')) {
		return;
	}
	wp_register_script(
		'the-reserve-block-editor',
		plugins_url('block.js', __FILE__),
		array('wp-blocks', 'wp-element', 'wp-components', 'wp-block-editor', 'wp-i18n'),
		THE_RESERVE_VERSION,
		true
	);
	wp_localize_script('the-reserve-block-editor', 'theReserveFeatures', the_reserve_features());
	register_block_type(
		'the-reserve/widget',
		array(
			'api_version'     => 2,
			'editor_script'   => 'the-reserve-block-editor',
			'render_callback' => 'the_reserve_render',
			'attributes'      => array(
				'feature' => array('type' => 'string', 'default' => 'quiz'),
				'scheme'  => array('type' => 'string', 'default' => ''),
				'accent'  => array('type' => 'string', 'default' => ''),
				'params'  => array('type' => 'string', 'default' => ''),
			),
		)
	);
}
add_action('init', 'the_reserve_register_block');

// ---- Settings page --------------------------------------------------------------

function the_reserve_admin_menu() {
	add_options_page(
		__('The Reserve', 'the-reserve'),
		__('The Reserve', 'the-reserve'),
		'manage_options',
		'the-reserve',
		'the_reserve_settings_page'
	);
}
add_action('admin_menu', 'the_reserve_admin_menu');

function the_reserve_admin_init() {
	register_setting(
		'the_reserve',
		THE_RESERVE_OPTION,
		array('sanitize_callback' => 'the_reserve_sanitize_settings')
	);
}
add_action('admin_init', 'the_reserve_admin_init');

function the_reserve_settings_page() {
	if (!current_user_can('manage_options')) {
		return;
	}
	$settings = the_reserve_settings();
	$field    = function ($name, $label, $help = '') use ($settings) {
		printf(
			'<tr><th scope="row"><label for="tr-%1$s">%2$s</label></th><td><input class="regular-text" id="tr-%1$s" name="%3$s[%1$s]" value="%4$s" />%5$s</td></tr>',
			esc_attr($name),
			esc_html($label),
			esc_attr(THE_RESERVE_OPTION),
			esc_attr($settings[$name]),
			$help ? '<p class="description">' . esc_html($help) . '</p>' : ''
		);
	};
	?>
	<div class="wrap">
		<h1><?php esc_html_e('The Reserve watch widgets', 'the-reserve'); ?></h1>
		<p><?php esc_html_e('Add a widget with the shortcode [the_reserve feature="quiz"] or the "The Reserve" block. Features: quiz, archetype, find, alternatives, stories.', 'the-reserve'); ?></p>
		<form action="options.php" method="post">
			<?php settings_fields('the_reserve'); ?>
			<table class="form-table" role="presentation">
				<?php
				$field('key', __('Public key', 'the-reserve'), __('pk_live_… from The Reserve. Your website address must be registered with The Reserve for the widgets to show.', 'the-reserve'));
				?>
				<tr>
					<th scope="row"><label for="tr-scheme"><?php esc_html_e('Look', 'the-reserve'); ?></label></th>
					<td>
						<select id="tr-scheme" name="<?php echo esc_attr(THE_RESERVE_OPTION); ?>[scheme]">
							<option value="" <?php selected($settings['scheme'], ''); ?>><?php esc_html_e('Dark (The Reserve)', 'the-reserve'); ?></option>
							<option value="light" <?php selected($settings['scheme'], 'light'); ?>><?php esc_html_e('Light', 'the-reserve'); ?></option>
						</select>
					</td>
				</tr>
				<?php
				$field('accent', __('Accent colour', 'the-reserve'), __('Buttons and links, e.g. #0a7cff', 'the-reserve'));
				$field('bg', __('Background colour', 'the-reserve'));
				$field('surface', __('Card colour', 'the-reserve'));
				$field('text', __('Text colour', 'the-reserve'));
				?>
				<tr>
					<th scope="row"><label for="tr-font"><?php esc_html_e('Font', 'the-reserve'); ?></label></th>
					<td>
						<select id="tr-font" name="<?php echo esc_attr(THE_RESERVE_OPTION); ?>[font]">
							<option value="" <?php selected($settings['font'], ''); ?>><?php esc_html_e("The Reserve's", 'the-reserve'); ?></option>
							<option value="system" <?php selected($settings['font'], 'system'); ?>><?php esc_html_e("The visitor's system font", 'the-reserve'); ?></option>
							<option value="serif" <?php selected($settings['font'], 'serif'); ?>><?php esc_html_e('Serif', 'the-reserve'); ?></option>
						</select>
					</td>
				</tr>
				<?php
				$field('radius', __('Corner rounding (px)', 'the-reserve'), __('0 to 32', 'the-reserve'));
				?>
			</table>
			<?php submit_button(); ?>
		</form>
	</div>
	<?php
}

function the_reserve_action_links($links) {
	array_unshift(
		$links,
		'<a href="' . esc_url(admin_url('options-general.php?page=the-reserve')) . '">' . esc_html__('Settings', 'the-reserve') . '</a>'
	);
	return $links;
}
add_filter('plugin_action_links_' . plugin_basename(__FILE__), 'the_reserve_action_links');

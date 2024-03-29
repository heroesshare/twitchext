
	// send updated live game info to PubSub for extension broadcast
	public function broadcast($stream_id, $live_id) {
		$this->load->model("Stream");
		
		$stream = $this->Stream->get($stream_id);
		$channel = $this->Stream->channel($stream_id);
		$players = $this->Stream->players($stream_id);

		log_message("debug","Twitch->Broadcast() :: Delivering live JSON to channel ".$channel);
		
		// check for certified owner
		$user_id = $this->Stream->user($stream_id);
				
		// make sure the game is still live
		$this->load->model("Live");
		$live = $this->Live->get($live_id);
		if ($live['status']=="Complete"):
			$output = array(
				"status" => "notice",
				"message" => "No games in play"
			);

		// try to generate array from live game		
		else:
			$output = $this->Live->json($live_id, $stream_id);
		
			// if something went wrong log the error but continue
			if ($output['status']!="success"):
				log_message("error", "Twitch->Broadcast() :: Error retrieving JSON for live #".$live_id." for channel ".$channel.": ".$output['message']);
			endif;
		endif;

		$message = $output['message'];
		$output = json_encode($output);
		
		// load config values
		$this->config->load("twitch");
		$client_id = $this->config->item("overlay_client_id");
		$secret = $this->config->item("overlay_secret_key");
		$owner_id = $this->config->item("overlay_owner_id");
		
		// build the URL
		$url = "https://api.twitch.tv/extensions/message/".$stream['channel_id'];
		
		// create and sign the JWT
		$payload = array(
			'exp' => time()+60*60,
			'channel_id' => (string)$stream['channel_id'],
			'role' => "external",
			'pubsub_perms' => array('send'=>array("broadcast"))
		);
		$jwt = JWT::encode($payload, $secret, 'HS256');
		
		// build the headers
		$headers = array(
			"Client-Id: ".$client_id,
			"Content-Type: application/json",
			"Authorization: Bearer ".$jwt
		);
		
		// build the body
		$body = array(
			"content_type" => "application/json",
			"message" => $output,
			"targets" => array("broadcast")
		);
		$body = json_encode($body);
		
		// setup cURL
		$ch = curl_init();
		curl_setopt($ch, CURLOPT_URL, $url);
		curl_setopt($ch, CURLOPT_HEADER, FALSE);
		curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
		curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
		curl_setopt($ch, CURLOPT_RETURNTRANSFER, TRUE);
		curl_setopt($ch, CURLOPT_ENCODING, "gzip");
		$result = curl_exec($ch);
		curl_close($ch);
		
		// start the log
		$log = array(
			"type" => "broadcast",
			"channel_id" => $stream['channel_id'],
			"stream_id" => $stream['id'],
			"channel" => $stream['channel'],
			"live_id" => $live_id
		);
		
		if (!empty($result)):
			// check for JSON response (error)
			$test = json_decode($result, TRUE);
			
			// if json_decode failed then it's a JWT
			if (is_null($test)):
				// decode the response
				$response = $this->Twitch->jwt_decode($result);

				$message = print_r($response, TRUE);
				$message = str_replace(array("    ","\n"), " ", $message);
				log_message("error","Twitch->Broadcast() :: ".$message);
				
				$log['status'] = "Error";
				$log['message'] = $message;
				
			// json_decode failed - likely an error message
			else:
				$message = "Invalid response from PubSub: ";
				if (!empty($test['error'])):
					$message .= $test['error'].". ";
				endif;
				if (!empty($test['message'])):
					$message .= $test['message'].". ";
				endif;
				
				log_message("error", "Twitch->Broadcast() :: ".$message);
				$log['status'] = "Error";
				$log['message'] = $message;
			endif;
		else:
			$log['status'] = "Success";
			$log['message'] = $message;
		endif;
		
		// update the last extension activity timestamp
		$this->db->where("stream_id", $stream_id);
		$this->db->limit(1);
		$this->db->update("overlays", array("activity" => date("Y-m-d H:i:s")));
		
		// add log entry
		$this->db->insert("overlay_logs", $log);
		log_message("debug", "Twitch->Broadcast() :: Sent broadcast for live #".$live_id." for channel ".$channel);
	}

	// output abilities and talents in JSON for Twitch extension cache
	public function gamedata() {
		header('Access-Control-Allow-Origin: *');
		header('Access-Control-Allow-Methods: GET, POST');
		header('Access-Control-Allow-Headers: authorization, x-extension-jwt, platform');
		header('Content-Type: application/json');
				
		// determine language
		$this->load->model("Language");
		if (! empty($_SERVER['HTTP_ACCEPT_LANGUAGE']) ):
			$language_id = $this->Language->browser2id($_SERVER['HTTP_ACCEPT_LANGUAGE']);
		endif;
		// if language failed to match it will be loaded off the stream below
		
		// check authorization
		$this->load->model("Twitch");
		$authorize = $this->Twitch->authorize();

		// if string returned it is an error message
		if (! is_array($authorize)):
			if ($authorize=="Authorization header missing"):
				log_message("debug","Twitches->GameData() :: ".$authorize);
			else:
				log_message("error","Twitches->GameData() :: ".$authorize);
			endif;
			
			return;
		endif;
		$channel_id = $authorize['channel_id'];
		
		// start the log
		$log = array(
			"type" => "gamedata",
			"channel_id" => $authorize['channel_id'],
			"expired_at" => date("Y-m-d H:i:s", $authorize['exp']),
			"role" => $authorize['role'],
		);
		
		// conditional fields
		if (isset($language_id))
			$log['language_id'] = $language_id;
		if (! empty($authorize['opaque_user_id']))
			$log['opaque_user_id'] = $authorize['opaque_user_id'];
		if (! empty($authorize['user_id']))
			$log['twitch_user_id'] = $authorize['user_id'];
	
		// try to match a user off IP
		$ip_address = $this->input->ip_address();
		$user_id = $this->User->ip_address2id($ip_address);
		if (! empty($user_id))
			$log['user_id'] = $user_id;
		$log['ip_address'] = ip2long($ip_address);
					
		if (empty($channel_id)):
			// log the error
			$log['status'] = "Error";
			$log['message'] = "Missing channel ID on extension call";
			$this->db->insert("overlay_logs", $log);
			
			// send back error message
			$output = [
				"status" => "error",
				"message" => "Missing channel ID"
			];
			echo json_encode($output);
			exit(1);
		endif;		
				
		$this->load->model("Live");
		$this->load->model("Stream");

		// check for stream
		$stream_id = $this->Stream->channel_id2id($channel_id);
		if (empty($stream_id)):
			// log the error
			$log['status'] = "Error";
			$log['message'] = "Attempt to load extension data from non-existent channel, channel ID#: ".$channel_id;
			$this->db->insert("overlay_logs", $log);
		
			$output = [
				"status" => "error",
				"message" => "Channel not registered"
			];
			echo json_encode($output);
			exit(2);
		endif;
		$stream = $this->Stream->get($stream_id);
		$log['stream_id'] = $stream['id'];
		$log['channel'] = $stream['channel'];
		
		// if failed to match a language from HTTP header, fallback to language from stream
		if (! is_numeric($language_id) )
			$language_id = $this->Language->shortname2id($stream['language']);
		// if everything fails default to English
		if (! is_numeric($language_id))
			$language_id = $this->Language->shortname2id("en");
	
		$log['language_id'] = $language_id;
		
		// special case when passed master channel
		if ($stream['channel']=="tattersail1"):
		
		// match channel to latest live game
		else:
			
			// check for verified owner
			$user_id = $this->Stream->user($stream_id);
			if (empty($user_id)):
				// log the error
				$log['status'] = "Error";
				$log['message'] = "Attempt to load extension from unverified channel: ".$stream['channel'];
				$this->db->insert("overlay_logs", $log);

				$output = [
					"status" => "error",
					"message" => "Channel not verified"
				];
				echo json_encode($output);
				exit(3);
			endif;
		
			// load players for this stream
			$players = $this->Stream->players($stream_id);
			if (empty($players)):
				$log['status'] = "Error";
				$log['message'] = "No players associated with channel: ".$stream['channel'];
				$this->db->insert("overlay_logs", $log);
				
				$output = [
					"status" => "error",
					"message" => "No players registered for this channel"
				];
				echo json_encode($output);
				exit(4);
			endif;
		endif;

		// check for cached file
		$language = $this->Language->get($language_id);
		// if this isn't a language we have localized fall back to English
		if (empty($language['localization'])):
			$language_id = $this->Language->shortname2id("en");
			$language = $this->Language->get($language_id);
		endif;
		
		$cache_file = FCPATH."assets/gamedata/".$language['localization'].".json.gz";
		if (! is_file($cache_file)):
			
			log_message("error","Twitches->GameData() :: Missing cached gamedata file: ".$cache_file);
			
			// fall back to English
			$cache_file = FCPATH."assets/gamedata/enus.json.gz";

			if (! is_file($cache_file)):
				$log['status'] = "Error";
				$log['message'] = "Missing fallback cached gamedata file; aborting";
				$this->db->insert("overlay_logs", $log);

				$output = [
					"status" => "error",
					"message" => "Failed to load gamedata"
				];
				echo json_encode($output);
				exit(5);
			endif;
		endif;

		// log it
		$log['status'] = "Success";
		$log['message'] = "Transferring cached game data from ".$cache_file;
		$this->db->insert("overlay_logs", $log);

		// output for extension
		header('Content-Encoding: gzip');
		readfile($cache_file);
		exit(0);
	}
	
	// output live game JSON for Twitch extension
	public function fetch() {
		
		header('Access-Control-Allow-Origin: *');
		header('Access-Control-Allow-Methods: GET, POST');
		header('Access-Control-Allow-Headers: authorization, x-extension-jwt, platform');
		header('Content-Type: application/json');
					
		// check authorization
		$this->load->model("Twitch");
		$authorize = $this->Twitch->authorize();

		// if string returned it is an error message
		if (! is_array($authorize)):
			if ($authorize=="Authorization header missing"):
				log_message("debug","Twitches->Fetch() :: ".$authorize);
			else:
				log_message("error","Twitches->Fetch() :: ".$authorize);
			endif;
			
			return;
		endif;
		$channel_id = $authorize['channel_id'];
		log_message("debug","Twitches->Fetch() :: Attempt to load extension data from channel ID#: ".$channel_id);

		// start the log
		$log = array(
			"type" => "fetch",
			"channel_id" => $authorize['channel_id'],
			"expired_at" => date("Y-m-d H:i:s", $authorize['exp']),
			"role" => $authorize['role'],
		);
		
		// conditional fields
		if (! empty($authorize['opaque_user_id'])):
			$log['opaque_user_id'] = $authorize['opaque_user_id'];
		endif;
		if (! empty($authorize['user_id'])):
			$log['twitch_user_id'] = $authorize['user_id'];
		endif;
	
		// try to match a user off IP
		$ip_address = $this->input->ip_address();
		$user_id = $this->User->ip_address2id($ip_address);
		if (! empty($user_id))
			$log['user_id'] = $user_id;
		$log['ip_address'] = ip2long($ip_address);
					
		if (empty($channel_id)):
			// log the error
			$log['status'] = "Error";
			$log['message'] = "Missing channel ID on extension call";
			$this->db->insert("overlay_logs", $log);
			
			// send back error message
			$output = [
				"status" => "error",
				"message" => "Missing channel ID"
			];
			echo json_encode($output);
			exit(1);
		endif;
				
		$this->load->model("Live");
		$this->load->model("Stream");

		// check for stream
		$stream_id = $this->Stream->channel_id2id($channel_id);
		if (empty($stream_id)):
			// log the error
			$log['status'] = "Error";
			$log['message'] = "Attempt to load extension data from non-existent channel, channel ID#: ".$channel_id;
			$this->db->insert("overlay_logs", $log);
		
			$output = [
				"status" => "error",
				"message" => "Channel not registered"
			];
			echo json_encode($output);
			exit(2);
		endif;
		$stream = $this->Stream->get($stream_id);
		$log['stream_id'] = $stream['id'];
		$log['channel'] = $stream['channel'];
		
		// special case when passed master channel
		if ($stream['channel']=="tattersail1"):
			// get latest live game with talent picks
			$this->db->select("live_id");
			$this->db->from("hpls_talents");
			$this->db->order_by("live_id", "desc");
			$this->db->limit(1);
			$query = $this->db->get();
			$result = $query->result_array();
			$live_id = $result[0]['live_id'];

		// match channel to latest live game
		else:
			
			// check for verified owner
			$user_id = $this->Stream->user($stream_id);
			if (empty($user_id)):
				// log the error
				$log['status'] = "Error";
				$log['message'] = "Attempt to load extension from unverified channel: ".$stream['channel'];
				$this->db->insert("overlay_logs", $log);

				$output = [
					"status" => "error",
					"message" => "Channel not verified"
				];
				echo json_encode($output);
				exit(3);
			endif;
		
			// load players for this stream
			$players = $this->Stream->players($stream_id);
			if (empty($players)):
				$log['status'] = "Error";
				$log['message'] = "No players associated with channel: ".$stream['channel'];
				$this->db->insert("overlay_logs", $log);
				
				$output = [
					"status" => "error",
					"message" => "No players registered for this channel"
				];
				echo json_encode($output);
				exit(4);
			endif;
		
			// get most recent live game with one of the players from the last hour
			$this->db->select("lives.id");
			$this->db->from("lives");
			$this->db->join("hpls","hpls.live_id=lives.id");
			$this->db->where_in("hpls.player_id", $players);
			$this->db->where("lives.status", "Active");
			$this->db->where("lives.created_at >", date("Y-m-d H:i:s",strtotime("-1 hour")));
			$query = $this->db->get();
			$result = $query->result_array();
			if (empty($result)):
				$message = "No games in play";
				$log['status'] = "Notice";
				$log['message'] = $message;
				$this->db->insert("overlay_logs", $log);
				
				$output = [
					"status" => "notice",
					"message" => "No games in play"
				];
				echo json_encode($output);
				return;
			endif;
			$live_id = $result[0]['id'];
		endif;
		
		$log['live_id'] = $live_id;
		$output = $this->Live->json($live_id, $stream['id']);

		// check for failures
		if ($output['status']!="success"):
			$log['status'] = "Error";
			$log['message'] = $output['message'];
			$this->db->insert("overlay_logs", $log);
			
			echo json_encode($output);
			exit(5);
		endif;

		// update the last extension activity timestamp
		$this->db->where("stream_id", $stream_id);
		$this->db->limit(1);
		$this->db->update("overlays", array("activity" => date("Y-m-d H:i:s")));
		
		// log success
		$log['status'] = "Success";
		$log['message'] = $output['message'];
		$this->db->insert("overlay_logs", $log);
		
		echo json_encode($output);
	}


	// record a broadcast as received
	public function receive() {
		
		header('Access-Control-Allow-Origin: *');
		header('Access-Control-Allow-Methods: GET, POST');
		header('Access-Control-Allow-Headers: authorization, x-extension-jwt, platform');
		header('Content-Type: application/json');
					
		// check authorization
		$this->load->model("Twitch");
		$authorize = $this->Twitch->authorize();

		// if string returned it is an error message
		if (! is_array($authorize)):
			if ($authorize=="Authorization header missing"):
				log_message("debug","Twitches->Receive() :: ".$authorize);
			else:
				log_message("error","Twitches->Receive() :: ".$authorize);
			endif;
			
			return;
		endif;
		$channel_id = $authorize['channel_id'];
		$message = "Received broadcast data from channel ID#: ".$channel_id;
		log_message("debug","Twitches->Receive() :: ".$message);

		// start the log
		$log = array(
			"type" => "receive",
			"channel_id" => $authorize['channel_id'],
			"expired_at" => date("Y-m-d H:i:s", $authorize['exp']),
			"role" => $authorize['role'],
		);
		
		// conditional fields
		if (! empty($authorize['opaque_user_id'])):
			$log['opaque_user_id'] = $authorize['opaque_user_id'];
		endif;
		if (! empty($authorize['user_id'])):
			$log['twitch_user_id'] = $authorize['user_id'];
		endif;
	
		// try to match a user off IP
		$ip_address = $this->input->ip_address();
		$user_id = $this->User->ip_address2id($ip_address);
		if (! empty($user_id))
			$log['user_id'] = $user_id;
		$log['ip_address'] = ip2long($ip_address);
					
		if (empty($channel_id)):
			// log the error
			$log['status'] = "Error";
			$log['message'] = "Missing channel ID on extension call";
			$this->db->insert("overlay_logs", $log);
			
			// send back error message
			$output = [
				"status" => "error",
				"message" => "Missing channel ID"
			];
			echo json_encode($output);
			exit(1);
		endif;
				
		$this->load->model("Live");
		$this->load->model("Stream");

		// check for stream
		$stream_id = $this->Stream->channel_id2id($channel_id);
		if (empty($stream_id)):
			// log the error
			$log['status'] = "Error";
			$log['message'] = "Attempt to load extension data from non-existent channel, channel ID#: ".$channel_id;
			$this->db->insert("overlay_logs", $log);
		
			$output = [
				"status" => "error",
				"message" => "Channel not registered"
			];
			echo json_encode($output);
			exit(2);
		endif;
		$stream = $this->Stream->get($stream_id);
		$log['stream_id'] = $stream['id'];
		$log['channel'] = $stream['channel'];

		// log success
		$log['status'] = "Success";
		$log['message'] = $message;
		$this->db->insert("overlay_logs", $log);
	}

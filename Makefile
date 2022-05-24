test_node_14:
	asdf install nodejs 14.17.6
	source $(ASDF_DIR)/asdf.sh && asdf shell nodejs 14.17.6 && npm t

test_node_15:
	@asdf install nodejs 15.14.0
	source $(ASDF_DIR)/asdf.sh && asdf shell nodejs 15.14.0 && npm t

packages = yieldmachine yieldmachine-react

$(foreach package,$(packages),$(package)):
	cd packages/$@ && npm exec -- jest

test_all: $(packages)
	echo "done"

watch_core:
	cd packages/yieldmachine && npm t

publish_core:
	cd packages/yieldmachine && npm publish

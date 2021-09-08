test_node_14:
	asdf install nodejs 14.17.6
	source $(ASDF_DIR)/asdf.sh && asdf shell nodejs 14.17.6 && npm t

test_node_15:
	@asdf install nodejs 15.14.0
	source $(ASDF_DIR)/asdf.sh && asdf shell nodejs 15.14.0 && npm t

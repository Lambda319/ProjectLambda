#!/bin/bash

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'
shopt -s extglob nullglob

basedir="./lambda"
packagefile="package.json"
file="index.js"


checkName() {
	if [[ "$1" = *" "* ]]; then
		echo -e "${RED}Error: Function name cannot contain spaces ${NC}"
		exit 1;
	fi
}

buildUpdate() {
	checkName "$1"
	echo -e "${GREEN}Found valid function '$name'${NC}"
	echo "zipping file..."
	makeZip "$1"
	echo -e "uploading file"
	lambdafunc=`aws lambda update-function-code --function-name $1 --zip-file fileb://./archive-$1.zip`
	if [[ -z "$lambdafunc" ]]; then
		echo -e "${RED}Error creating function in AWS ${NC}"
		deleteZip $1
		exit 1;
	else
		echo "$lambdafunc"
		echo -e "${GREEN} index.js uploaded to lambda function $1 ${NC}"
	fi
	deleteZip $1
	echo -e "${GREEN} Done ✔✔✔${NC}"
}

buildUploadAll() {
	cdarray=( "$basedir"/* )
	validarr=()

	for i in "${cdarray[@]}"
	do
		if [[ -f "$i/$file" ]]; then
			echo -e "${GREEN}Found valid function named${NC} '${i:9}'"
			validarr+=("${i:9}")
		fi
	done

	for i in "${validarr[@]}"
	do
		buildUpdate "$i"
	done
}

makeZip() {
	cd "$basedir/$1"
	zip "../../archive-$1.zip" "./index.js"
	cd "../../"
}

deleteZip() {
	echo "deleting archive-$1.zip ..."
	rm -f "./archive-$1.zip"
}

matchName() {
	name="${1#lambda/}"
	echo "$name"
}

createRole() {
	arn=`aws iam create-role --role-name $1 --path /service-role/\
		--assume-role-policy-document\
		 '{"Version": "2012-10-17","Statement": [{ "Effect": "Allow", "Principal": {"Service": "lambda.amazonaws.com"}, "Action": "sts:AssumeRole"}]}'\
		  --query "Role.Arn"`

	arn="${arn%\"}"
	arn="${arn#\"}"
	echo "$arn"
}

createPolicy() {
	policy=`aws iam attach-role-policy \
 		--role-name $1 \
 		--policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole`

 	echo "$policy"
}

createLambdaFunction() {

	name="$1"
	rolename="$2"
	arn="$3"

	echo "Creating lambda function...
			- Name: $name
			- Runtime:Node.JS 14.x
			- Role: $rolename
			- Role ARN: $arn"

	lambdafunc=`aws lambda create-function --function-name $name \
					--zip-file fileb://./archive-$name.zip --handler index.handler --runtime nodejs14.x \
					--role $arn`

	if [[ -z "$lambdafunc" ]]; then
		echo -e "${RED}Error creating function in AWS ${NC}"
		deleteZip
		exit 1;
	fi

	echo "$lambdafunc"
	echo -e "${GREEN} Successfully created lambda function '$name'${NC}"
	echo -e "${GREEN} index.js uploaded to lambda function${NC}"
}


checkName() {
	if [[ "$1" = *" "* ]]; then
		echo -e "${RED}Error: Function name cannot contain spaces ${NC}"
		exit 1;
	fi
}

createUpload(){
	checkName "$1"

	name=`matchName $1`
	echo "$name"

	if [[ -f "$basedir/$name/$file" ]]; then
		echo -e "${GREEN}Found valid function '$name'${NC}"
		echo "Building...."
		makeZip "$name"

		rolename="$name-lambda-role"
		echo "Using role $rolename"

		arn=`createRole $rolename`

		if [[ -z "$arn" ]]; then
			echo -e "${RED}Error creating role in AWS ${NC}"
			echo -e `rm ./archive-$name.zip`
			exit 1;
		fi

		echo -e "${GREEN} Created role $rolename${NC}"
		echo "Attaching Cloudwatch permissions..."


		policy=`createPolicy $rolename`

		if [[ -z "$policy" ]]; then
			echo -e "${GREEN} Attached policy to role $rolename${NC}"
			echo "Waiting for role to be created..."
			sleep 15

			createLambdaFunction "$name" "$rolename" "$arn"

		else
			echo -e "${RED} Error attaching policy to role $rolename in AWS ${NC}"
			deleteZip
			exit 1;
		fi
	else
		echo -e "${RED}ERROR${NC}: no local function with name '$1'"
		exit 1
	fi

	echo "Removing archive file"
	deleteZip $name
	echo -e "${GREEN} Done ✔✔✔${NC}"
}

if [[ `uname` == 'Darwin' ]]; then
	if [[ -z `pkgutil --pkgs | grep aws` ]]; then
		echo -e "${RED}ERROR${NC}: missing aws cli, see readme for instructions"
		exit 1;
	fi
fi



if [[ -z "$1" ]]; then
	echo -e "${RED}ERROR${NC}: invalid empty parameter. Expected '-a', '--create' or lambda function name"
	exit 1;
fi



if [[ "$1" == "-a" ]]; then
	echo "running lambda-build on all functions"
	buildUploadAll "$skip"
elif [[ "$1" == "--create" ]]; then
	if [[ -z "$2" ]]; then
		echo -e "${RED}ERROR${NC} missing function name"
		exit 1;
	fi
	if [[ -z "$3" ]]; then
		echo "Creating lambda function with name '$2'"
		createUpload "$2"
	else
		echo -e "${RED}Error: Invalid 3rd parameter ${NC}"
		echo -e "${RED}Note: Function name cannot contain spaces ${NC}"
		exit 1;
	fi
else
	name=`matchName $1`
	if [[ -f "$basedir/$name/$file" ]]; then
		buildUpdate "$name"
	else
		echo -e "${RED}ERROR${NC}: no valid function named '$1' found"
		exit 1;
	fi
fi